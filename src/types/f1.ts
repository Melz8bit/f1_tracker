export interface Driver {
    driverId: string; // Ergast uses driver name (ex: max_verstappen)
    code: string; // Driver's 3-letter code (ex: VER)
    permanentNumber: string; // Driver number
    givenName: string; // First name
    familyName: string; // Last name
    nationality: string;
    dateOfBirth: string;
}

export interface Constructor {
    constructorId: string; // Ergast's team name id (ex: red_bull)
    name: string; // Team name
    nationality: string;
}

export interface DriverStanding {
    position: number; // Championship position
    points: number;
    wins: number;
    driver: Driver;
    constructor: Constructor;
}

export interface ConstructorStanding {
    position: number; // Championship position
    points: number;
    wins: number;
    constructor: Constructor;
}

// Driver's result in a race
export interface RaceResult {
    position: number; // Finishing position
    positionText: string; // "1".."22", or R (retired), D (disqualified), W (withdrawn / did not start), N (not classified)
    points: number;
    driver: Driver;
    constructor: Constructor;
    grid: number; // Starting grid position
    laps: number; // Laps completed
    status: string; // Ex: Finished; +1 Lap; Engine; etc.
    time?: string; // Optional - absent if DNF
    fastestLap?: { rank: number; lap: number; time: string } // Optional
}

export interface Race {
    season: number; // Year number
    round: number;
    raceName: string;
    circuitId: string; // Ex: bahrain
    circuitName: string; // Ex: Bahrain International Circuit
    date: string;
    results: RaceResult[]; // Array of RaceResult interface
}

// One round of the season calendar (no results)
export interface ScheduleRace {
    season: number;
    round: number;
    raceName: string;
    circuitId: string;
    circuitName: string;
    locality: string;
    country: string;
    date: string; // Race day, YYYY-MM-DD
    firstPracticeDate?: string; // Weekend start, YYYY-MM-DD
    sprintDate?: string; // Present only on sprint weekends
}

export interface Pole {
    round: number;
    driver: Driver;
    constructor: Constructor;
}
