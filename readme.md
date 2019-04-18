Hola, this project is a simple minimal implemention of serverless websockets on AWS.

Important files are:
- `serverless.yml`
    Contains the configuration for the serverless framework. You will see that they contain a new event type `websocket`, and they contain routes for the different types of websocket events. Such as: `connect`, `disconnect`, `default`. Connect is triggered when someone first makes a connection, disconnect when someone disconnects, and default when a message is received from a client.

- `handler.js`
    standard stuff if you are familiar with serverless. The network-related stuff like sending message to client is handled inside communication.js, and the database queries are handled inside data.js

- `data.js`
    Decoupled database from handler logic. You need a database to use websockets. Because serverless is expected to be spun up on each request we do not keep session state in memory, so how we keep track of our clients we store their connectionId in a database. This has disadvantages and advantages, more scalable but could be slower.

- `communication.js`
    This is where we make messages back to the clients. The way AWS does it is the websocket connection is actually maintained in APIGateway, not in Lambda. So in order to send a message to our clients we need to send a message to APIGateway and we do that using aws-sdk `apigatewaymanagementapi.postToConnection`.

This is not a full extensive list of all serverless websocket features on AWS, just a small example.

Gotchas!
1) Do not use the default aws-sdk that is provided in Lambda. You don't know what version it is, and I struggled many times not understanding why `apigatewaymanagementapi.postToConnection` would not work how I expected and it's because the aws-sdk library on Lambda is very old. You must have your own aws-sdk installed inside node_modules before you do a serverless deploy, and if you do have your own installed then Lambda will use yours and not the default.

2) The websocket connection is created *after* the connect handler has returned statusCode 200. You cannot send a message inside the connect handler. Only use postToConnection inside the default handler.
