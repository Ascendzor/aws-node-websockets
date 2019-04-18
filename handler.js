const {reply} = require('./communication')
const {addConnection, listConnections, removeConnection} = require('./data')

module.exports.connect = async (event, context) => {
  const connectionId = event.requestContext.connectionId
  return addConnection({connectionId})
    .then(res => {
      return {
        statusCode: 200
      }
    }).catch(console.log)
}

module.exports.disconnect = async (event, context) => {
  const connectionId = event.requestContext.connectionId
  return removeConnection({connectionId})
    .then(res => {
      return {
        statusCode: 200
      }
    }).catch(console.log)
}

module.exports.default = async (event, context) => {
  const connectionId = event.requestContext.connectionId
  return listConnections()
    .then(res => {
      return reply({requestContext: event.requestContext, body: res})
    }).then(res => {
      return {
        statusCode: 200
      }
    }).catch(console.log)
}
