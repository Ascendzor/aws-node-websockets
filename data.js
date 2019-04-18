const util = require('util')
const secrets = require('./secrets')

const mysql = require('mysql')
const connection = mysql.createConnection({
    user: 'chill',
    password: secrets.password,
    host: secrets.host,
    database: "chill"
})

module.exports = {
  addConnection: ({connectionId}) => new Promise((resolve, reject) => {
    const theQuery = `insert into connections (connectionId) values ('${connectionId}')`
    connection.query(theQuery, (err, results, fields) => {
      if(err) return reject(err)
      resolve(results)
    })
  }),
  listConnections: () => new Promise((resolve, reject) => {
    connection.query(`select * from connections`, (err, results, fields) => {
      if(err) return reject(err)
      resolve(results)
    })
  }),
  removeConnection: ({connectionId}) => new Promise((resolve, reject) => {
    connection.query(`delete from connections where connectionId='${connectionId}'`, (err, results, fields) => {
      if (err) return reject(err)
      resolve(results)
    })
  })
}
