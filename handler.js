const {toConnection} = require('./sendMessage')
const {addConnection, listConnections, removeConnection} = require('./data')

module.exports.connect = (event, context) => {
  console.log({event, context})
  const connectionId = event.requestContext.connectionId
  return addConnection({connectionId})
    .then(res => {
      return {
        statusCode: 200
      }
    })
    .catch(console.log)
}

module.exports.default = (event, context) => {
  console.log({event, context})
  const connectionId = event.requestContext.connectionId
  return listConnections()
    .then(res => toConnection({domainName: event.requestContext.domainName, body: res, connectionId}))
    .then(res => {
      return {
        statusCode: 200
      }
    })
    .catch(console.log)
}

module.exports.disconnect = (event, context) => {
  console.log({event, context})
  const connectionId = event.requestContext.connectionId
  return removeConnection({connectionId})
    .then(res => {
      return {
        statusCode: 200
      }
    })
    .catch(console.log)
}
