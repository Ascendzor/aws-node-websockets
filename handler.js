const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const magic = require('./magic')

const {
  stage,
  connectionsTable,
  gameStateTable,
  playersGameStatesTable,
  domainName,
  region
} = process.env

AWS.config.update({region: region})
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const dynamoDb = new AWS.DynamoDB.DocumentClient()

const sendMessage = async ({connectionId, body}) => {
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
    TableName: connectionsTable,
    Item: {
      connectionId: event.requestContext.connectionId
    }
  }).promise()
}

module.exports.receivedMessage = async (event, context) => {
  console.log({event, context})
  const body = JSON.parse(event.body)
  console.log({body})

  if(body.action === 'joinMultiplayer') {
    const thisUser = await dynamoDb.get({
      TableName: playersGameStatesTable,
      Key: {
        connectionId: event.requestContext.connectionId
      }
    }).promise()
    if(thisUser.connectionId !== undefined) {
      console.log("something has wrong, a user has tried to join multiplayer while already in multiplayer.")
      return {statusCode: 200}
    }

    //Add the player to multiplayer
    await dynamoDb.put({
      TableName: playersGameStatesTable,
      Item: {
        connectionId: event.requestContext.connectionId
      }
    }).promise()
    
    await sendMessage({
      body: {
        action: 'message',
        payload: 'You have been added to multiplayer'
      },
      connectionId: event.requestContext.connectionId
    })

    const hostGameStateResponse = await dynamoDb.get({
      TableName: playersGameStatesTable,
      Key: {
        connectionId: 'host'
      }
    }).promise()
    console.log({hostGameStateResponse})

    //If no game is currently playing, start a new one.
    if(hostGameStateResponse.connectionId === undefined) {
      await dynamoDb.put({
        TableName: playersGameStatesTable,
        Item: {
          connectionId: 'host'
        }
      }).promise()
      await sqs.sendMessage({
        MessageBody: uuidv4(),
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/MyQueue",
        DelaySeconds: 2
      }).promise()
    }
  }
  return {statusCode: 200}
}

module.exports.disconnect = async (event, context) => {
  console.log({event, context})

  await dynamoDb.delete({
    TableName: connectionsTable,
    Key: {
      connectionId: event.requestContext.connectionId
    }
  }).promise()

  await dynamoDb.delete({
    TableName: playersGameStatesTable,
    Key: {
      connectionId: event.requestContext.connectionId
    }
  }).promise()

  return {statusCode: 200}
}

module.exports.newGame = async (event) => {
  console.log(JSON.stringify(event))

  const seed = event.Records[0].body
  const currentGame = dynamoDb.get({
    TableName: gameStateTable,
    Key: "theGame"
  })
  if(currentGame.seed && currentGame.seed !== seed) {
    console.log('tried to start a game when a game was already going')
    return {statusCode: 200}
  }
  const newGame = {
    seed,
    gameState: magic.generateGameState(seed)
  }

  const playerGameStatesScanResponse = await dynamoDb.scan({
    TableName: playersGameStatesTable
  }).promise()

  if(playerGameStatesScanResponse.Items.length <= 1) {
    console.log('no one is playing anymore, very sad :(')
    return {statusCode: 200}
  }
  console.log({playerGameStatesScanResponse})
  await Promise.all(playerGameStatesScanResponse.Items.map(player => {
    return dynamoDb.put({
      TableName: playersGameStatesTable,
      Item: {
        connectionId: player.connectionId,
        ...newGame
      }
    }).promise()
  }))

  const buildTime = 120

  await Promise.all(playerGameStatesScanResponse.Items.map(player => {
    console.log(player)
    if(player.connectionId === 'host') return Promise.resolve()
    return sendMessage({
      body: {
        action: 'newGame',
        payload: {
          ...newGame,
          buildTime
        }
      },
      connectionId: player.connectionId
    })
  }))

  await dynamoDb.put({
    TableName: gameStateTable,
    Item: {...newGame,
      reference: 'theGame'
    }
  }).promise()

  await sqs.sendMessage({
    MessageBody: seed,
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/endOfBuildTime",
    DelaySeconds: buildTime
  }).promise()

  return {statusCode: 200}
}

module.exports.onEndOfBuildTime = async (event) => {
  console.log(JSON.stringify(event))
  const seed = event.Records[0].body
  
  const playerGameStatesScanResponse = await dynamoDb.scan({
    TableName: playersGameStatesTable
  }).promise()
  
  const players = playerGameStatesScanResponse.Items.map(player => {
    // const grid = magic.decodeGrid(player.gameState.grid)
    return {
      // connectionId: player.connectionId,
      // score: magic.getPlayerPositions(grid).length
      name: 'player name goes here',
      gameState: player.gameState
    }
  })
  console.log({players})

  await Promise.all(playerGameStatesScanResponse.Items.map(player => {
    if(player.connectionId === 'host') return Promise.resolve()
    return sendMessage({
      connectionId: player.connectionId,
      body: {
        action: 'endOfBuildTime',
        payload: players
      }
    })
  }))

  const highestScore = players.map(p => magic.getPlayerPositions(magic.decodeGrid(p.gameState.grid)).length).sort((a, b) => a < b ? 1 : -1)[0]
  console.log({highestScore})

  const secondsForShowcase = Math.floor((highestScore/60) + 10)
  console.log('show case would take ' + secondsForShowcase + ' many seconds')
  await sqs.sendMessage({
    MessageBody: seed,
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/endOfShowcase",
    DelaySeconds: secondsForShowcase
  }).promise()

  return {statusCode: 200}
}

module.exports.onEndOfShowcase = async (event) => {
  console.log(JSON.stringify(event))

  await dynamoDb.delete({
    TableName: gameStateTable,
    Key: {
      reference: "theGame"
    }
  }).promise()

  const playersResponse = await dynamoDb.scan({
    TableName: playersGameStatesTable
  }).promise()

  if(playersResponse.Items.length <= 1) {
    console.log('nobody is playing :( we do nothing')
    return {statusCode: 200}
  }

  await sqs.sendMessage({
    MessageBody: uuidv4(),
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/MyQueue",
    DelaySeconds: 5
  }).promise()

  return {statusCode: 200}
}