const {reply} = require('./communication')
const {addConnection, listConnections, removeConnection} = require('./data')

module.exports.connect = async (event, context) => {
  const connectionId = event.requestContext.connectionId
  return addConnection({connectionId}).then(res => {
    return reply({requestContext: event.requestContext, body: event})
  }).then(res => {
    return {
      statusCode: 200
    }
  })
}

module.exports.disconnect = async (event, context) => {
  const connectionId = event.requestContext.connectionId
  return removeConnection({connectionId}).then(res => {
    console.log('removed')
  }).then(res => {
    return {
      statusCode: 200
    }
  })
}

module.exports.default = async (event, context) => {
  return listConnections().then(res => {
    return reply({requestContext: event.requestContext, body: res})
  }).then(res => {
    return {
      statusCode: 200
    }
  })
}
