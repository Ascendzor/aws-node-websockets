import {generateGame, decodeGrid, getPlayerPositions} from './magic'
import {getMmoGame, sendMessage, addConnection, getPlayer, getMmoPlayers, setPlayersPlay, setMmoGame, addPlayerToMmo, removePlayerFromMmo, deleteConnection, sendMmoMessage} from './stater'
import { IGame } from './types';
import 'source-map-support/register'

const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const secondsForVictor = 5

const {
  region
} = process.env

AWS.config.update({region: region})
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

const buildTime = 10
const buildPreparationTime = 5

module.exports.connect = async (event, context) => {
  console.log({event, context})
  await addConnection(event.requestContext.connectionId)

  return {statusCode: 200}
}

module.exports.receivedMessage = async (event, context) => {
  console.log({event, context})
  const body = JSON.parse(event.body)
  console.log({body})

  const mmoGame = await getMmoGame()
  const players = await getMmoPlayers()
  const player = await getPlayer(event.requestContext.connectionId)
  if(body.type === 'joinMultiplayer') {
    const {name} = body.payload
    if(player !== undefined) {
      console.log("something has gone wrong, a user has tried to join multiplayer while already in multiplayer.")
      await sendMessage({
        connectionIds: [event.requestContext.connectionId],
        body: {type: 'gameState', payload: {game: mmoGame, players, connectionId: event.requestContext.connectionId}}
      })
      return {statusCode: 200}
    }
    
    await addPlayerToMmo(event.requestContext.connectionId, name, generateGame(mmoGame.seed))

    if(new Date().getTime() - new Date(mmoGame.startedBuildingAt).getTime() > 1000 * 60 * 5) {
      console.log('The startedBuildingAt is too old. Printing mmogame, before starting a new game')
      console.log(mmoGame)
      await setMmoGame({...mmoGame, phase: 'readyForNewGame'})
      await sqs.sendMessage({
        MessageBody: uuidv4(),
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/MyQueue",
        DelaySeconds: 2
      }).promise()
    }

    //If no game is currently playing, start a new one.
    if(mmoGame.phase === 'readyForNewGame') {

      console.log('Publishing sqs message to create a new game')
      await sqs.sendMessage({
        MessageBody: uuidv4(),
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/MyQueue",
        DelaySeconds: 2
      }).promise()
    } 

    await sendMessage({
      connectionIds: [event.requestContext.connectionId],
      body: {type: 'gameState', payload: {game: mmoGame, players, connectionId: event.requestContext.connectionId}}
    })
  } else if(body.type === 'play') {
    console.log('received playerGame message')
    console.log(body.payload)
    if(!body.payload) return console.log('someone is upto something')
    await setPlayersPlay([player], body.payload)
    await sendMmoMessage({
      body: {type: 'updatePlayer', payload: player}
    })
  }

  return {statusCode: 200}
}

module.exports.disconnect = async (event, context) => {
  console.log({event, context})

  await removePlayerFromMmo(event.requestContext.connectionId)
  await deleteConnection(event.requestContext.connectionId)

  return {statusCode: 200}
}

module.exports.newGame = async (event) => {
  console.log(JSON.stringify(event))

  const seed = event.Records[0].body
  const mmoGame = await getMmoGame()
    
  if(mmoGame !== undefined && mmoGame.phase !== 'readyForNewGame') {
    console.log('tried to start a game when a game was already going')
    return {statusCode: 200}
  }

  const mmoPlayers = await getMmoPlayers()

  if(mmoPlayers.length < 1) {
    console.log('no one is playing anymore, very sad :(')
    return {statusCode: 200}
  }
  
  const newGame = {
    id:  'mmo',
    seed,
    startedBuildingAt: new Date(buildPreparationTime*1000+new Date().getTime()).toISOString(),
    phase: 'building',
    buildTime
  } as IGame;

  await setMmoGame(newGame)
  await setPlayersPlay(mmoPlayers, generateGame(seed))
  await sendMmoMessage({
    body: {
      type: 'newGame',
      payload: newGame
    }
  })

  console.log('Publishing sqs message for endOfBuildTime')
  await sqs.sendMessage({
    MessageBody: seed,
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/endOfBuildTime",
    DelaySeconds: buildTime + buildPreparationTime // The 3 is time for the players to send their gameStates
  }).promise()

  return {statusCode: 200}
}

module.exports.onEndOfBuildTime = async (event) => {
  console.log(JSON.stringify(event))
  const seed = event.Records[0].body

  const players = await getMmoPlayers()
  const mmoGame = await getMmoGame()

  if(mmoGame.phase !== 'building') {
    console.log('something has gone out of sync')
    return {statusCode: 200}
  }

  await sendMmoMessage({
    body: {
      type: 'endOfBuildTime',
      payload: {
        players,
        startRunningAt: new Date(new Date().getTime() + 3000).toISOString()
      }
    }
  })
  
  const highestScore = Math.max(...players.map(p => getPlayerPositions(decodeGrid(p.play.grid)).length))
  console.log({highestScore})

  await setMmoGame({...mmoGame, phase: 'running'})

  const secondsForShowcase = Math.floor(highestScore/60)
  console.log('show case would take ' + secondsForShowcase + ' many seconds')
  console.log('Publishing sqs message for newGame')
  console.log(secondsForShowcase + secondsForVictor)
  await sqs.sendMessage({
    MessageBody: seed,
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/endOfRunTime",
    DelaySeconds: secondsForShowcase
  }).promise()

  return {statusCode: 200}
}

module.exports.endOfRunTime = async (event) => {
  const mmoGame = await getMmoGame()
  await setMmoGame({...mmoGame, phase: 'readyForNewGame'})
  await sqs.sendMessage({
    MessageBody: uuidv4(),
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/702407458234/MyQueue",
    DelaySeconds: secondsForVictor
  }).promise()
}