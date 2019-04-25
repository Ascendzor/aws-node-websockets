# aws-node-websockets

Hola, this project is a simple minimal implemention of serverless websockets in node on AWS.

# Works out of the box 🦄

1) `git clone git@github.com:Ascendzor/aws-node-websockets.git`
2) `cd aws-node-websockets`
3) `npm i`
4) `cp .env.yml.example .env.yml`
5) `sls deploy`
6) Wait 10 minutes... The first deploy takes a long time because it creates a new RDS instance.
7) Deployment finishes, wss endpoint is printed in your terminal.

Explanation of important files below.

# serverless.yml
Contains the configuration for the serverless framework that this project is based on. Has 2 major parts:

1) Three functions, [`connect`, `disconnect`, `default`] that all have the event type `websocket` trigger. Connect is triggered when someone first makes a connection, disconnect when someone disconnects, and default when a message is received from a client. Serverless websockets are slightly different. The websocket connections are maintained in ApiGateway, not Lambda, so that means that the `return` for these functions is a message to ApiGateway *not the user who triggered the lambda*. Returning satusCode 200 to ApiGateway lets ApiGateway know that everything is working as expected. But then how do we send messages to users? See the [communication.js](https://github.com/Ascendzor/aws-node-websockets/blob/master/readme.md#communicationjs) section.

2) An RDS database has been defined inside the resources section. On a traditional server model the server would store the current connections inside memory, we could do that in serverless but if two or more Lambdas were created we would have two or more sets of connections. Instead we write our connections to a database.

# handler.js
Not much to see here, if you are familiar with serverless you will be familiar with the code here. The return of statusCodes here is to ApiGateway and not your users. See the [communication.js](https://github.com/Ascendzor/aws-node-websockets/blob/master/readme.md#communicationjs) for how to message users.

# data.js
Data layer for managing connections. Uses [serverless-mysql](https://github.com/jeremydaly/serverless-mysql) to keep one connection to the rds instance per Lambda.

# communication.js
This is where we make messages back to the clients. The way AWS manages serverless websockets is the websocket connection is maintained in APIGateway, not in Lambda. To send a message to our users we need to send a message to APIGateway and we do that using aws-sdk `apigatewaymanagementapi.postToConnection`.

# Gotchas!
1) Do not use the default aws-sdk that is provided in Lambda. You don't know what version it is, and I struggled many times not understanding why `apigatewaymanagementapi.postToConnection` would not work how I expected and it's because the aws-sdk library on Lambda is very old. You must have your own aws-sdk installed inside node_modules before you do a serverless deploy, and if you do have your own installed then Lambda will use yours and not the default.

2) The websocket connection is created *after* the connect handler has returned statusCode 200. You cannot send a message inside the connect handler. Only use postToConnection inside the default handler.
