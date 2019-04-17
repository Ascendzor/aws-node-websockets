const util = require('util')
const AWS = require('aws-sdk')
const secrets = require('./secrets')

const mysql = require('mysql')
const connection = mysql.createConnection({
    host: secrets.host,
    user: 'chill',
    password: secrets.password,
    database: "chill"
})

module.exports = {
  addConnection: ({connectionId}) => new Promise((resolve, reject) => {
    connection.query(`insert into connections (connectionId) values ('${connectionId}')`, (err, results, fields) => {
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
