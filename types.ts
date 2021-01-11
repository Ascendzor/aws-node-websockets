export type phase = 'readyForNewGame' | 'building' | 'running';
export type IPath = {x: number, y: number}[];

export interface IGridItem {
    x: number;
    y: number;
    contains: string;
}

export interface IGame {
    id: string;
    seed: string;
    startedBuildingAt: string;
    phase: phase;
    buildTime: number;
}

export interface IPlay {
    toolbox: {
        wall: number;
        slowTower: number;
    }
    grid: string;
}

export interface IPlayer {
    connectionId: string;
    play: IPlay;
    name: string;
}

export interface IConnection {
    connectionId: string;
}