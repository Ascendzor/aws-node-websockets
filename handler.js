const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const magic = require('./magic')
AWS.config.update({region: process.env.region})
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const dynamoDb = new AWS.DynamoDB.DocumentClient()
const {
  stage,
  gameStateTable,
  playersGameStates
} = process.env

const sendMessage = async ({domainName, connectionId, body}) => {
  const url = `https://${domainName}/${stage}`
  const apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29', endpoint: url})
  return apigatewaymanagementapi.postToConnection({
    ConnectionId: connectionId,
    Data: JSON.stringify(body)
  }).promise()
}

module.exports.connect = async (event, context) => {
  console.log({event, context})
  return dynamoDb.put({
    TableName: process.env.dynamodb,
    Item: {
      connectionId: event.requestContext.connectionId,
      domainName: event.requestContext.domainName
    }
  }).promise()
}

module.exports.receivedMessage = async (event, context) => {
  console.log({event, context})
  const something = await dynamoDb.scan({TableName: process.env.dynamodb}).promise()
  await sendMessage({
    domainName: event.requestContext.domainName,
    body: something,
    connectionId: event.requestContext.connectionId
  })
  return {statusCode: 200}
}

module.exports.disconnect = async (event, context) => {
  console.log({event, context})
  await dynamoDb.delete({
    TableName: process.env.dynamodb,
    Key: {
      connectionId: event.requestContext.connectionId
    }
  }).promise()
  return {statusCode: 200}
}

module.exports.newGame = async (event) => {
  console.log(JSON.stringify(event))
  const playerGameStatesScanResponse = await dynamoDb.scan({
    TableName: playersGameStates
  }).promise()
  console.log(playerGameStatesScanResponse)
  console.log('deleting all playergamestates')
  await Promise.all(playerGameStatesScanResponse.Items.map(item => {
    return dynamoDb.delete({
      TableName: playersGameStates,
      Key: {
        connectionId: item.connectionId
      }
    }).promise()
  }))
  console.log('all playergamestates deleted')
  const buildTime = 120

  const seed = uuidv4()
  const newGame = {
    seed,
    gameState: magic.generateGameState(seed)
  }

  await dynamoDb.put({
    TableName: gameStateTable,
    Item: newGame
  }).promise()

  const connectionResponse = await dynamoDb.scan({TableName: process.env.dynamodb}).promise()
  console.log(connectionResponse )

  // Add all of the players
  await Promise.all(connectionResponse.Items.map(async item => {
    await dynamoDb.put({
      TableName: playersGameStates,
      Item: {
        gameState: newGame.gameState,
        connectionId: item.connectionId
      }
    }).promise()
    await sendMessage({
      domainName: item.domainName,
      body: {...newGame,
        connectionId: item.connectionId,
        buildTime
      },
      connectionId: item.connectionId
    })
  }))

  //Add the host, for a baseline time
  await dynamoDb.put({
    TableName: playersGameStates,
    Item: {
      gameState: newGame.gameState,
      connectionId: 'host'
    }
  }).promise()

  await sqs.sendMessage({
    MessageBody: '_',
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/endOfBuildTime",
    DelaySeconds: buildTime
  }).promise()

  return {statusCode: 200}
}

module.exports.onEndOfBuildTime = async (event) => {
  console.log(JSON.stringify(event))
  const connectionResponse = await dynamoDb.scan({TableName: process.env.dynamodb}).promise()
  console.log({connectionResponse})
  await Promise.all(connectionResponse.Items.map(async item => {
    return await sendMessage({...item,
      body: 'end of build time'
    })
  }))

  const playersGamesStatesScan = await dynamoDb.scan({TableName: playersGameStates}).promise()
  console.log({playersGamesStatesScan})
  
  const something = playersGamesStatesScan.Items.map(item => {
    const grid = magic.decodeGrid(item.gameState.grid)
    return {
      connectionId: item.connectionId,
      score: magic.getPlayerPositions(grid).length
    }
  }).sort((a, b) => a.score > b.score ? 1 : -1)

  console.log(something)

  return {statusCode: 200}
}