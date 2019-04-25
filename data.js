const util = require('util')
const secrets = require('./secrets')

const connection = require('serverless-mysql')({
  config: {
    host     : process.env.databaseEndpoint,
    database : 'nodeawswebsockets',
    user     : process.env.databaseUsername,
    password : process.env.databasePassword
  }
})
connection.query('create table if not exists connections (connectionId varchar(255) NOT NULL, primary key (connectionId))')

module.exports = {
  addConnection: ({connectionId}) => connection.query(`insert into connections (connectionId) values ('${connectionId}')`),
  listConnections: () => connection.query(`select * from connections`),
  removeConnection: ({connectionId}) => connection.query(`delete from connections where connectionId='${connectionId}'`)
}
