# Enface Pay +ID authorization Node.js library

Enface offers secure, blockchain based authorization feature for any websites (or apps) using [Enface Pay +ID application](https://apps.apple.com/us/app/enface-pay-id/id1480029680 "Enface Pay +ID"). Our authentication process is based on strong cryptographic algorithms and are military safe.

To enable our solution you should pass the following steps:

- Register for free at [Enface website](https://admin.enface.io "Enface website"), visit “[Biometric authorization](https://admin.enface.io/authorization "Biometric authorization")”page  and click on the “Add new project” button. **Setup “API key for authentication”** from the drop-down of the project panel. **Copy the “Project id” and “Secret key” variables for future usage.**
- Integrate the [frontend widget](https://github.com/safead/enface-auth-widget "frontend widget") on your website or application.
- Setup backend environment, using instructions below.

This package is for backend integration with Node.js environment. You should provide any existing Express instance to enable EnfaceAuth.

## Installation

### npm

```bash
npm i --save enface-auth-node-enfaceid
```

### yarn

```bash
yarn add enface-auth-node-enfaceid
```

## Usage

ES2015 module import:
```js
import { EnfaceAuth } from "enface-auth-node-enfaceid";
```
CommonJS module require:
```js
const { EnfaceAuth } = require("enface-auth-node-enfaceid");
```

### Initialization:
```js
new EnfaceAuth({

  httpServer: <object>,
  callbackUrl: <string>,
  projectId: <string>,
  secretCode: <string>,
  fields: <string>,
  debug: <boolean>, // debug logs

});
 ```
### EnfaceAuth parameters:

`httpServer (Express instance)`

EnfaceAuth module will start in HTTP/S mode and will use default Express port to listen all the connections. In this mode both [frontend widget](https://github.com/safead/enface-auth-widget "frontend widget") and Enface API server should be able connect to http(s)://yourdomain.com to process required operations.

`callbackUrl: <string>`

http(s) URL to connect to this backend module.

`projectId: <string>`

“Project id” variable from the [Enface website](https://admin.enface.io "Enface website") project description.

`secretCode: <string>`

“Secret key” variable from the [Enface website](https://admin.enface.io "Enface website") project description.

`fields: <string>`

The data fields, you want to request from a user during authorization process (separated by commas). The available values are: 'full_name', 'email', 'phone_mobile'. For example, to request full information about the user, 'fields' variable should be set to 'full_name,email,phone_mobile'. You can ommit the 'fileds' variable, and will receive only user login in Enface ID platform.

### Here is how EnfaceAuth is integrated at our own Node.js server.

```js
new EnfaceAuth({

  httpServer: app, // app is the existing Express instance
  projectId: process.env.AUTH_PRODUCT_ID,
  secretCode: process.env.BIO_AUTH_SECRET,
  callbackUrl: 'https://enface-api-server.herokuapp.com',

});
```
