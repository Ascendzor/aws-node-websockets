const path = require('path')

module.exports = {
  entry: './handler.js',
  target: 'node',
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  }
}
