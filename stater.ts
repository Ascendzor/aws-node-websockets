import { IPlayer, IGame, IPlay, IConnection } from "./types"

const AWS = require('aws-sdk')
const dynamoDb = new AWS.DynamoDB.DocumentClient()

const {
    stage,
    connectionsTable,
    gamesTable,
    playersTable,
    domainName
  } = process.env


export const getMmoGame = async (): Promise<IGame> => {
    const currentGameResponse = await dynamoDb.get({
        TableName: gamesTable,
        Key: {
            reference: "mmo"
        }
    }).promise()
    console.log({currentGameResponse})
    return currentGameResponse.Item
}

export const getMmoPlayers = async (): Promise<IPlayer[]> => {
    const playersScanResponse = await dynamoDb.scan({
        TableName: playersTable
    }).promise()
    console.log({playersScanResponse})

    return playersScanResponse.Items as IPlayer[]
}

export const getAllConnections = async () => {
    const connectionsScanResponse = await dynamoDb.scan({
        TableName: connectionsTable
    }).promise()

    return connectionsScanResponse.Items as IConnection[]
}
export const deleteConnection = async (connectionId: string) => {
    await dynamoDb.delete({
        TableName: connectionsTable,
        Key: {
            connectionId
        }
    }).promise()
}

export const setPlayersPlay = async (players: IPlayer[], play: IPlay) => {
    await Promise.all(players.map(player => {
        return dynamoDb.put({
          TableName: playersTable,
          Item: {...player,
            play
          }
        }).promise()
    }))
    console.log('set players play')
}

export const addPlayerToMmo = async (connectionId: string, name: string, play: IPlay) => {
    await dynamoDb.put({
        TableName: playersTable,
        Item: {
            connectionId,
            name,
            play
        }
    }).promise()
    console.log('added player to mmo')
}

export const removePlayerFromMmo = async (connectionId: string) => {
    await dynamoDb.delete({
        TableName: playersTable,
        Key: {
            connectionId
        }
    }).promise()
    console.log('removed player from mmo')
}

export const setMmoGame = async (game: IGame) => {
    await dynamoDb.put({
        TableName: gamesTable,
        Item: {...game,
            reference: 'mmo'
        }
    }).promise()
    console.log('set mmo game')
}

export const sendMessage = async ({connectionIds, body}: {connectionIds: string[], body: any}) => {
    const url = `https://${domainName}/${stage}`
    const apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29', endpoint: url})
    await Promise.all(connectionIds.map(async connectionId => {
        try {
            return apigatewaymanagementapi.postToConnection({
                ConnectionId: connectionId,
                Data: JSON.stringify(body)
            }).promise()    
        } catch(error) {
            console.log('something is wrong with the connections')
            console.log(error)
        }
        
    }))
    console.log('sent message')
}

export const sendMmoMessage = async ({body}: {body: any}) => {
    const [players, connections] = await Promise.all([getMmoPlayers(), getAllConnections()])
    
    const allConnectionIds = connections.map(c => c.connectionId) as string[]
    
    const connectionIdsToSend = (await Promise.all(players.map(async player => {
        if(!allConnectionIds.includes(player.connectionId)) {
            await deleteConnection(player.connectionId)
            return null
        }
        return player.connectionId
    }))).filter(p => !!p)

    await sendMessage({connectionIds: connectionIdsToSend, body})
}

export const addConnection = async (connectionId: string) => {
    await dynamoDb.put({
        TableName: connectionsTable,
        Item: {
            connectionId
        }
    }).promise()
    console.log('added connection')
}

export const getPlayer = async (connectionId: string): Promise<IPlayer> => {
    const getPlayerResponse = await dynamoDb.get({
        TableName: playersTable,
        Key: {
            connectionId
        }
    }).promise()
    console.log({getPlayerResponse})
    return getPlayerResponse.Item
}