# Sage Pay Form Server for Node.js

This module provides integration for Node.js applications wishing to utilise Sage Pay Server Integration.

## Overview

Knowledge of the [Server Integration](https://www.sagepay.co.uk/support/find-an-integration-document/server-integration-documents) is essential.

This module provides utility a utility to correctly parse and format messages
to Sage Pay and Express handler functions that handle the HTTP requests and
responses properly.

## Running the example in test mode

The fasted way to try this module is to run the example in test mode.

Test mode allows you to develop your checkout process without a public IP
address or use of privilaged ports. It does not use the Sage Pay systems at
all, no communication with Sage Pay occurs. From the point of view of your
application everything happens on your server in exactly the same way, but the
web browser is not redirected to Sage Pay, only to your completion URL at the
end of the process.

It does not currently check the structure of your transaction request, except
that it has a `VendorTxCode` so your implementation may fail when used against
Sage Pay systems.

To run the example in test mode use the following command:

```
npm install
node example --vendor test --gatewayUrl test:// --port 8080
```

Open `http://localhost:8080` in your browser.

In test mode, the module will bypass the Sage Pay API and return a successful
transaction.

## Running the Example against Sage Pay

You need a fixed IP address and the use of port 80. There appears to be no
other way to develop against Sage Pay.

To give the process access to low ports use the following command:

```
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/nodejs
```

Then to start the server run:

```
npm install
node example --vendor <your-sagepay-vendor-name> --gatewayUrl https://test.sagepay.com/gateway/service/vspserver-register.vsp --port 80
```

Then access your server using a web browser on port 80. You will be asked for
configuration information and redirected to a page where you can enter a
transaction registration request.

## Documentation

### SagepayServerExpress

```
require("sagepay-server").SagepayServerExpress;
```

Provides integration between Sage Pay and an Express JS server.

#### SagepayServerExpress.constructor

```
var foo = new SagepayServerExpress(options);
```

* `options` Required. Settings used by the server.
* `options.vendor` Required. The vendor name.
* `options.gatewayUrl` Required. The URL to the Sage Pay server gateway.
    Use "test://" for the test mode.
* `options.putTransaction` Required. See `SagepayServerExpress.putTransaction`.
* `options.getTransaction` Required. See `SagepayServerExpress.getTransaction`.
* `options.getCompletionUrl` Required. See
    `SagepayServerExpress.getCompletionUrl`.

#### SagepayServerExpress.putTransaction

This is called at two stages. Firstly, when a transaction is successfully
registered with Sage Pay. Secondly, when a transaction notification is accepted
from Sage Pay. It should store the object that is provided in it's entirety so
it can be quickly returned by a call to `getTransaction`. The object is
suitable for JSON serialisation.

Returns a `Promise` that resolves when `transaction` is saved.

```
function(transaction) { ... }
```

* `transaction` Required. An object containing transaction information.
* `transaction.registration` Required. An object containing registration
    information.
* `transaction.registration.request` Required. The object that was passed to
    `SagepayServerExpress.register`.
* `transaction.registration.request.VendorTxCode` Required. A `string` that 
    uniquely identifies this transaction. This should be used as the key in the
    underlyig storage system.
* `transaction.notification` Optional. An object containing notification
    information.
* `transaction.notification.request` An object containing data from the
    notification.
* `transaction.notification.response` An object containing data from the
    response that was returned for the notification.

This function is only ever called for successful registration options. The
status in the registration response will always be `OK`.

`notification` is only saved if the signature and notification are valid, so
developers do not need to check the notification response status as it will
always be `OK`.

#### SagepayServerExpress.getTransaction

Called to retrieve a transaction that we previously stored using a call to
`putTransaction`. It should return the object that was stored without
modification. 

Returns a `Promise` that resolves to the transaction saved by a call to
`SagepayServerExpress.putTransaction`.

```
function(vendorTxCode) { ... }
```

If the transaction is not found the `code` property of the error must be set to
`ESAGEPAYNOTFOUND` for proper processing to continue.

An implementation must be provided when the constructor is called.

#### SagepayServerExpress.getCompletionUrl

This is called when a valid notification is received from Sage Pay.

Returns a `Promise` that resolves to the `string` URL that the user should be
redirected to following the transaction.

```
function(req, transaction) { ... }
```

* `req` the Express request object. `res` and `next` are not provided as these
    should not be called directly by user code.
* `transaction` an object containing full transaction, including the
    notification from Sage Pay.

#### SagepayServerExpress.register

Register a transaction and perform the direct to Sage Pay.

This should be called when the transaction has been built and the user has
clicked a putting to commence payment. It should be the last thing to be done
and will end the response.

```
foo.register(transaction, req, res, next);
```

* `transaction` Required. An object with properties and values as defined for
    transaction registration. See Sage Pay documenation.
* `req`, `res`, `next` Required. Values passed by `Express` to the handler that
    invoked this function.

### SagepayServerExpress.notification

Handle the notification HTTP request.

This should be called to handle the incoming on the URL provided as the
`transaction.NotificationURL` to the `register` function.

IMPORTANT: Any middleware that runs prior to this call that parses the request
body will cause this function to fail. It should be the last call that the
handler makes, and is usually the only call.

```
foo.notification(req, res, next);
```

* `req`, `res`, `next` Required. Values passed by `Express`.

## Licence

MIT
