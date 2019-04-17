const handler = require('./handler')

handler.connect({
  requestContext: {
    domainName: 'domainNameValue',
    connectionId: 'connectionIdValue'
  }
}).then(console.log)

handler.default({
  requestContext: {
    domainName: 'domainNameValue',
    connectionId: 'connectionIdValue'
  }
}).then(console.log)

handler.disconnect({
  requestContext: {
    domainName: 'domainNameValue',
    connectionId: 'connectionIdValue'
  }
}).then(console.log)
