# aws-node-websockets usecase

Bootstrap a serverless microservice that interfaces by websockets in 10 minutes.
Reference for people setting things up themselves.

# AWS Services & Pricing

It's pretty much free until your service gets usage. You'll be paying <$1 per month for developing on.

This service uses these AWS services and their pricing. 
- Lambda - Always Free tier. [Click here for pricing](https://aws.amazon.com/lambda/pricing/)
- CloudWatch - Always Free tier. [Click here for pricing](https://aws.amazon.com/cloudwatch/pricing/)
- ApiGateway - 12 month free tier. [Click here for pricing](https://aws.amazon.com/api-gateway/pricing/)
- IAM - Free
- S3 - 12 month free tier. [Click here for pricing](https://aws.amazon.com/s3/pricing/)
- DyanamoDB - Always Free tier. [Click here for pricing](https://aws.amazon.com/dynamodb/pricing/)

# Prerequisites

Find the AWS Serverless prerequisites [here](https://serverless.com/framework/docs/providers/aws/guide/quick-start/)

# Usage - deploy your own serverless websockets right now 🦄

1) `git clone git@github.com:Ascendzor/aws-node-websockets.git`
2) `cd aws-node-websockets`
3) `npm i`
4) `cp env.yml.example env.yml`
5) `sls deploy`
7) Deployment finishes, wss endpoint is printed in your terminal. Then use a tool like [wscat](https://www.npmjs.com/package/wscat) to test your endpoint.

Explanation of important files below.

# [serverless.yml](https://github.com/Ascendzor/aws-node-websockets/blob/master/serverless.yml)
Contains the configuration for the serverless framework that this project is based on. Has 2 major parts:

1) Three functions, [`connect`, `disconnect`, `default`] that all have the event type `websocket` trigger. Connect is triggered when someone first makes a connection, disconnect when someone disconnects, and default when a message is received from a client. Serverless websockets are slightly different. The websocket connections are maintained in ApiGateway, not Lambda, so that means that the `return` for these functions is a message to ApiGateway *not the user who triggered the lambda*. Returning satusCode 200 to ApiGateway lets ApiGateway know that everything is working as expected. But then how do we send messages to users? See the [sendMessage.js](https://github.com/Ascendzor/aws-node-websockets/blob/master/readme.md#sendmessagejs) section.

2) A dynamodb database has been defined inside the resources section. On a traditional server model the server would store the current connections inside memory. Instead in Serverless we write our connections to a database, so that all Lambda instances are consistent.

# [handler.js](https://github.com/Ascendzor/aws-node-websockets/blob/master/handler.js)
Not much to see here, if you are familiar with serverless you will be familiar with the code here. The return of statusCodes here is to ApiGateway and not your users. See the [sendMessage.js](https://github.com/Ascendzor/aws-node-websockets/blob/master/readme.md#sendmessagejs) for how to message users.

# (data.js)[https://github.com/Ascendzor/aws-node-websockets/blob/master/data.js]
Data layer for managing connections. Uses the dynamodb instance defined inside the [serverless.yml](https://github.com/Ascendzor/aws-node-websockets/blob/master/serverless.yml)

# [sendMessage.js](https://github.com/Ascendzor/aws-node-websockets/blob/master/sendMessage.js)
This is where we make messages back to the clients. The way AWS manages serverless websockets is the websocket connection is maintained in APIGateway, not in Lambda. To send a message to our users we need to send a message to APIGateway and we do that using aws-sdk `apigatewaymanagementapi.postToConnection`.

# Gotchas!
1) Do not use the default aws-sdk that is provided in Lambda. You don't know what version it is, and I struggled many times not understanding why `apigatewaymanagementapi.postToConnection` would not work how I expected and it's because the aws-sdk library on Lambda is very old. You must have your own aws-sdk installed inside node_modules before you do a serverless deploy, and if you do have your own installed then Lambda will use yours and not the default.

2) The websocket connection is created *after* the connect handler has returned statusCode 200. You cannot send a message inside the connect handler. Only use postToConnection inside the default handler.
