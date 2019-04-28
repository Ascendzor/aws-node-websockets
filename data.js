const AWS = require('aws-sdk')
AWS.config.update({region: process.env.region})
const dynamoDb = new AWS.DynamoDB.DocumentClient()

module.exports = {
  addConnection: ({connectionId}) => {
    const params = {
      TableName: process.env.dynamodb,
      Item: {connectionId}
    }
    return dynamoDb.put(params).promise()
  },
  listConnections: () => {
    const params = {
      TableName: process.env.dynamodb
    }
    return dynamoDb.scan(params).promise()
  },
  removeConnection: ({connectionId}) => {
    const params = {
      TableName: process.env.dynamodb,
      Key: {connectionId}
    }
    return dynamoDb.delete(params).promise()
  }
}
