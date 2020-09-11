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

  const currentGameResponse = await dynamoDb.get({
    TableName: gameStateTable,
    Key: {
      reference: "theGame"
    }
  }).promise()
  console.log({currentGameResponse})
  const currentGame = currentGameResponse.Item

  const thisUserResponse = await dynamoDb.get({
    TableName: playersGameStatesTable,
    Key: {
      connectionId: event.requestContext.connectionId
    }
  }).promise()
  console.log(thisUserResponse)
  const thisUser = thisUserResponse.Item

  if(body.type === 'joinMultiplayer') {
    const {name} = body.payload
    if(thisUser !== undefined) {
      console.log("something has wrong, a user has tried to join multiplayer while already in multiplayer.")
      await sendMessage({
        connectionId: event.requestContext.connectionId,
        body: {type: 'gameState', payload: currentGame.gameState}
      })
      return {statusCode: 200}
    }

    //If no game is currently playing, start a new one.
    if(currentGame.phase === 'readyForNewGame') {
      //Add the player to multiplayer
      await dynamoDb.put({
        TableName: playersGameStatesTable,
        Item: {
          connectionId: event.requestContext.connectionId,
          name,
          gameState: null
        }
      }).promise()

      console.log('Publishing sqs message to create a new game')
      await sqs.sendMessage({
        MessageBody: uuidv4(),
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/MyQueue",
        DelaySeconds: 2
      }).promise()
    } else {
      console.log('adding the new player with gameState:')
      console.log(currentGame.gameState)
      await dynamoDb.put({
        TableName: playersGameStatesTable,
        Item: {...thisUser,
          name,
          gameState: currentGame.gameState
        }
      }).promise()
    }

    await sendMessage({
      connectionId: event.requestContext.connectionId,
      body: {type: 'gameState', payload: currentGame.gameState}
    })
  } else if(body.type === 'gameState') {
    //Check that body.payload is legit first
    console.log('received gameState message')
    console.log(body.payload)
    if(!body.payload) return console.log('someone is upto something')
    await dynamoDb.put({
      TableName: playersGameStatesTable,
      Item: {...thisUser,
        gameState: body.payload
      }
    }).promise()
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
  const currentGameResponse = await dynamoDb.get({
    TableName: gameStateTable,
    Key: {
      reference: "theGame"
    }
  }).promise()
  console.log(currentGameResponse)
  const currentGame = currentGameResponse.Item
  
  if(currentGame !== undefined && currentGame.phase !== 'readyForNewGame') {
    console.log('tried to start a game when a game was already going')
    sendMessage({
      connectionId: event.requestContext.connectionId,
      body: {
        type: 'gameState',
        payload: currentGame.gameState
      }
    })
    return {statusCode: 200}
  }

  const playerGameStatesScanResponse = await dynamoDb.scan({
    TableName: playersGameStatesTable
  }).promise()
  console.log({playerGameStatesScanResponse})

  if(playerGameStatesScanResponse.Items.length < 1) {
    console.log('no one is playing anymore, very sad :(')
    return {statusCode: 200}
  }
  
  const newGame = {
    seed,
    gameState: magic.generateGameState(seed),
    phase: 'building'
  }
  
  await Promise.all(playerGameStatesScanResponse.Items.map(player => {
    return dynamoDb.put({
      TableName: playersGameStatesTable,
      Item: {...player,
        gameState: newGame.gameState
      }
    }).promise()
  }))

  const buildTime = 120

  await Promise.all(playerGameStatesScanResponse.Items.map(player => {
    return sendMessage({
      body: {
        type: 'newGame',
        payload: {
          gameState: newGame.gameState,
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

  console.log('Publishing sqs message for endOfBuildTime')
  await sqs.sendMessage({
    MessageBody: seed,
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/endOfBuildTime",
    DelaySeconds: buildTime + 3 // The 3 is time for the players to send their gameStates
  }).promise()

  return {statusCode: 200}
}

module.exports.onEndOfBuildTime = async (event) => {
  console.log(JSON.stringify(event))
  const seed = event.Records[0].body
  
  const playerGameStatesScanResponse = await dynamoDb.scan({
    TableName: playersGameStatesTable
  }).promise()
  console.log({playerGameStatesScanResponse})

  const currentGameResponse = await dynamoDb.get({
    TableName: gameStateTable,
    Key: {
      reference: "theGame"
    }
  }).promise()
  console.log({currentGameResponse})
  const currentGame = currentGameResponse.Item

  if(currentGame.phase !== 'building') {
    console.log('something has gone out of sync')
    return {statusCode: 200}
  }
  
  if(currentGame.seed !== seed) {
    console.log('tried to end build time not for the current game')
    return {statusCode: 200}
  }
  
  const players = playerGameStatesScanResponse.Items.map(player => {
    if(player.gameState === null) {
      return {
        name: player.name,
        gameState: currentGame.gameState
      }
    }
    return {
      name: player.name,
      gameState: player.gameState
    }
  })
  console.log(JSON.stringify(players))

  await Promise.all(playerGameStatesScanResponse.Items.map(player => {
    return sendMessage({
      connectionId: player.connectionId,
      body: {
        type: 'endOfBuildTime',
        payload: players
      }
    })
  }))

  const allPlayersScores = players.map(p => magic.getPlayerPositions(magic.decodeGrid(p.gameState.grid)).length)
  console.log({allPlayersScores})

  const highestScore = [...players.map(p => magic.getPlayerPositions(magic.decodeGrid(p.gameState.grid)).length).sort((a, b) => a < b ? 1 : -1), 0][0]
  console.log({highestScore})

  await dynamoDb.put({
    TableName: gameStateTable,
    Item: {...currentGame,
      phase: 'running'
    }
  }).promise()

  const secondsForShowcase = Math.floor(highestScore/60) + 10
  console.log('show case would take ' + secondsForShowcase + ' many seconds')
  console.log('Publishing sqs message for endOfShowcase')
  await sqs.sendMessage({
    MessageBody: seed,
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/endOfShowcase",
    DelaySeconds: secondsForShowcase
  }).promise()

  return {statusCode: 200}
}

module.exports.onEndOfShowcase = async (event) => {
  console.log(JSON.stringify(event))

  const currentGameResponse = await dynamoDb.get({
    TableName: gameStateTable,
    Key: {
      reference: "theGame"
    }
  }).promise()
  console.log({currentGameResponse})
  const currentGame = currentGameResponse.Item

  if(currentGame.phase !== 'running') {
    console.log('something has gone out of sync')
    return {statusCode: 200}
  }

  await dynamoDb.put({
    TableName: gameStateTable,
    Item: {...currentGame,
      phase: 'readyForNewGame'
    }
  }).promise()

  console.log('Publishing sqs message for new game')
  await sqs.sendMessage({
    MessageBody: uuidv4(),
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/MyQueue",
    DelaySeconds: 5
  }).promise()

  return {statusCode: 200}
}