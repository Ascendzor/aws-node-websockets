const util = require('util')
const AWS = require('aws-sdk')
AWS.config.update({region: process.env.region})
const stage = process.env.stage

module.exports = {
  toConnection: ({domainName, connectionId, body}) => {
    const url = `https://${domainName}/${stage}`
    const apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29', endpoint: url})
    return apigatewaymanagementapi.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(body)
    }).promise()
  }
}
