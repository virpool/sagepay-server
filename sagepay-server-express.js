"use strict";

const assert = require("assert");
const extend = require("extend");
const SagepayServerUtil = require("./sagepay-server-util");

// These characters are the only valid key and value characters.
// WARNING: The character that looks like a Z below is not what it seems.
const validChars = /^[A-ｚ0-9@:,{}"#^\[\]*'\\/\-_.$?+();|! ~]*$/;

/*
Checks the data for keys containing characters that are invalid for use in the
Sage Pay API.
*/
function validate(data) {
    for(var key in data) {
        if (!(validChars.test(key)))
            throw new Error("Invalid character in key '" + key + "'.");

        var value  = data[key];
        
        if (!(typeof value === "string") && value.toString)
            value = value.toString();
            
        if (value === null) value = "";
        
        if (!(validChars.test(value)))
            throw new Error("Invalid character in value for '" + key + "'.");
    }
}

// Alternative interface for express
class SagepayServerExpress {
    /*
    SagepayServerIntegration(options)
    @options Optional. Contains connetion options.
    @options.gatewayUrl
        Optional. The URL of the payment gateway, defaults to the Sage Pay
        test system.
    */
    constructor(options) {
        assert(options, "options is required");
        assert(typeof options.putTransaction === "function", "options.saveTransaction is required");
        assert(typeof options.getTransaction === "function", "options.getTransaction is required");
        assert(typeof options.getCompletionUrl === "function", "options.getCompletionUrl is required");
        options = extend({}, options); // Copy
        this._options = options;
        this._util = new SagepayServerUtil(options);
    }

    /*
    register(object, object, object, function)
    
    Completes the Express handling for registering a transaction with Sage Pay.
    If successful the `saveTransaction` function will be called, otherwise the
    error is allowed to propogate through to the Express error handler.
    */
    register(transaction, req, res, next) {
        assert(transaction);
        validate(transaction);

        const validStatusValues = ["OK", "OK REPEATED"];
        var registerResponse;
        this._util.register(transaction).then(
            (data) => {
                if (validStatusValues.indexOf(data.Status) < 0) {
                    throw new Error(data.StatusDetail);
                }
                registerResponse = data;
                return;
            }
        ).then(
            () => {
                return this._options.putTransaction({
                    registration: {
                        request: transaction,
                        response: registerResponse
                    }
                });
            }
        ).then(
            () => {
                res.redirect(registerResponse.NextURL);
            }
        ).catch(next);
    }
    
    /*
    Handles the notificate request from Sage Pay.
    
    If the request parses OK the transaction is requested using `getTransaction`
    and the notification information is saved using `putTransaction`. If the
    transaction is successful then `commitTransaction` is called, otherwise
    `abortTransaction` is called. The response to Sage Pay is sent after this
    and the transaction is always aborted if an error occurs.
    */
    notification(req, res, next) {
        var notification, transaction;
        this._util.parseNotification(req)
        .then(
            (data) => {
                notification = data;
                return this._options.getTransaction(notification.VendorTxCode);
            }
        )
        .then(
            (data) => {
                transaction = data;
                var signatureValid = this._util.validateNotificationSignature(
                    transaction.registration.response.VPSTxId,
                    transaction.registration.response.SecurityKey,
                    notification
                );
                if (!signatureValid) {
                    var err = Error("Signature is not valid.");
                    err.code = "ESAGEPAYINVALID";
                    throw err;
                }
                return this._options.getCompletionUrl(
                    notification
                );
            }
        )
        .then(
            (redirectUrl) => {
                var response = {
                    Status: "OK",
                    RedirectUrl: redirectUrl
                };
                var formattedResponse = this._util.formatNotificationResponse(response);
                res.send(formattedResponse).end();
                transaction.notification = {
                    request: notification,
                    response: response
                };
                return this._options.putTransaction(transaction);
            }
        )
        .catch(err => {
            var response = {}, status;
            switch(err.code) {
                case "ESAGEPAYNOTFOUND":
                    response.Status = "ERROR";
                    status = 200; // Sage Pay requires this
                    break;
                case "ESAGEPAYINVALID":
                    response.Status = "INVALID";
                    status = 200; // Sage Pay requires this
                    break;
                default:
                    status = 500;
                    break;
            }
            if (err.redirectUrl) {
                response.RedirectURL = err.redirectUrl;
            }
            response.StatusDetail = err.toString();
            response = this._util.formatNotificationResponse(response);
            if (status === 200) {
                console.warn("Sagepay notification error:", response);
                res.status(status).send(response).end();
            }
            else {
                next(err);
            }
        })
        .catch(next); // This runs if the error handler throws an error.
    }
}

module.exports = SagepayServerExpress;
