const util = require('util')
const AWS = require('aws-sdk')
AWS.config.update({region: process.env.region})
const stage = 'dev'

module.exports = {
  toConnection: ({domainName, connectionId, body}) => {
    const url = util.format(util.format('https://%s/%s', domainName, stage)) //construct the needed url
    const apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({apiVersion: '2018-11-29', endpoint: url})
    return apigatewaymanagementapi.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(body)
    }).promise()
  }
}
