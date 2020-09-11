const randomSeed = require('random-seed')
const ThetaStarFinder = require('pathfinding/src/finders/ThetaStarFinder')
const PathFinder = require('pathfinding')
const minimumWalls = 15
const maximumWalls = 30
const minimumSlowTowers = 1
const maximumSlowTowers = 3
const gridHeight = 13
const gridLength = Math.round(gridHeight * (233/144)) //the golden ratio
const startingPlace = {x: 0, y: Math.floor(gridHeight/2)}
const endingPlace = {x: gridLength-1, y: Math.floor(gridHeight/2)}
const chanceOfStaticWall = 15
const slowReach = 2.1
const slowRate = 2

const decodedToEncoded = {
    wall: 'w',
    slowTower: 's',
    staticWall: 'z',
    space: 'x'
}
const encodedToDecoded = {
    w: 'wall',
    s: 'slowTower',
    z: 'staticWall',
    x: 'space'
}

const encodeGrid = grid => {
    let encodedGrid = ''
    Array.from({length: gridLength}).forEach((_, x) => {
        Array.from({length: gridHeight}).forEach((_, y) => {
            encodedGrid += decodedToEncoded[grid[x][y].contains]
        })
    })
    return encodedGrid
}

module.exports.generateGameState = (seed) => {
    return {
        toolbox: {
            wall: minimumWalls + randomSeed.create(seed).range(maximumWalls - minimumWalls),
            slowTower: minimumSlowTowers + randomSeed.create(seed).range(maximumSlowTowers - minimumSlowTowers)
        },
        grid: encodeGrid(generateStartingGrid(seed))
    }
}

module.exports.encodeGrid = encodeGrid

module.exports.decodeGrid = encodedGrid => {
    const grid = Array.from({length: gridLength}).map((_, x) => {
        return Array.from({length: gridHeight}).map((_, y) => {
            return {
                x, y, contains: encodedToDecoded[encodedGrid[x * gridHeight + y]]
            }
        })
    })
    return grid
}

const generateStartingGrid = (seed) => {
    let path = []
    let grid = []
    while(path.length === 0) {
        grid = Array.from({length: gridLength}).map((_, x) => {
            return Array.from({length: gridHeight}).map((_, y) => {
                if(x === 0) return {x, y, contains: 'space'}
                if(x === gridLength-1) return {x, y, contains: 'space'}

                return {
                    x, y,
                    contains: randomSeed.create(seed+x+y).range(100) > chanceOfStaticWall ? 'space' : 'staticWall'
                }
            })
        })
        path = getPath(grid)
    }

    return grid
}
module.exports.generateStartingGrid = generateStartingGrid

const getPath = (grid) => {
    return (new ThetaStarFinder()).findPath(startingPlace.x, startingPlace.y, endingPlace.x, endingPlace.y, gridToPathfinderGrid(grid)).map(pathFinderPath => {
        return {
            x: pathFinderPath[0],
            y: pathFinderPath[1]
        }
    })
}
module.exports.getPath = getPath

const gridToPathfinderGrid = grid => {
    return new PathFinder.Grid(gridLength, gridHeight, Array.from({length: gridHeight}).map((_, y) => {
        return Array.from({length: gridLength}).map((_, x) => {
            return grid[x][y].contains === 'space' ? 0 : 1
        })
    }))
}

const distanceBetweenPoints = (pointA, pointB) => {
    return Math.hypot(pointB.x-pointA.x, pointB.y-pointA.y)
}

const getPlayerPositions = (grid) => {
    const path = getPath(grid)
    const distances = path.map((point, i) => {
        if(i === path.length-1) return 0
        return distanceBetweenPoints(point, path[i+1])
    })
    const positions = distances.map((distance, z) => {
        if(z+1 === distances.length) return []
        const direction = {
            x: path[z+1].x - path[z].x,
            y: path[z+1].y - path[z].y
        }
        return Array.from({length: distance*50}).map((_, i) => {
            const portion = i/distance/50
            return {
                x: path[z].x + direction.x*portion,
                y: path[z].y + direction.y*portion
            }
        })
    }).flat()

    let slowTowers = []
    grid.forEach((_, x) => {
        grid[x].forEach((_, y) => {
            if(grid[x][y].contains === 'slowTower') slowTowers.push({
                x,
                y
            })
        })
    })
    
    return positions.map((position, i) => {
        const playerIsNearSlowTower = slowTowers.some(({x, y, slowedAt}, i) => {
            return distanceBetweenPoints({x, y}, position) < slowReach
        })

        if(playerIsNearSlowTower) return Array.from({length: slowRate}).map((_, i) => {
            return {...position, slowed: true}
        })

        return position
    }).flat()
}
module.exports.getPlayerPositions = getPlayerPositions