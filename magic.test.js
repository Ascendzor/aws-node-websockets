const generateGameState = require('./magic').generateGameState
const generateStartingGrid = require('./magic').generateStartingGrid
const encodeGrid = require('./magic').encodeGrid
const decodeGrid = require('./magic').decodeGrid
const getPath = require('./magic').getPath
const getPlayerPositions = require('./magic').getPlayerPositions

test('generateGameState looks good', () => {
    const gameState = generateGameState('1.4142')
    expect(gameState).toMatchSnapshot()
});

test('generateStartingGrid looks good', () => {
    const grid = generateStartingGrid('1.4142')
    expect(grid).toMatchSnapshot()
})

test('encode grid looks good', () => {
    const grid = generateStartingGrid('1.4142')
    const encodedGrid = encodeGrid(grid)
    expect(encodedGrid).toMatchSnapshot()
});

test('decode grid looks good', () => {
    const grid = generateStartingGrid('1.4142')
    const encodedGrid = encodeGrid(grid)
    const decodedGrid = decodeGrid(encodedGrid)
    expect(decodedGrid).toMatchSnapshot()
})

test('getPath looks good', () => {
    const grid = generateStartingGrid('1.4142')
    const path = getPath(grid)
    expect(path).toMatchSnapshot()
})

test('get player positions works', () => {
    const grid = generateStartingGrid('1.4142')
    const path = getPath(grid)
    const playerPositions = getPlayerPositions(grid, path)
    expect(playerPositions).toMatchSnapshot()
})