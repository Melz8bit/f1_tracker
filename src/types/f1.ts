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

export type TeamId =
  | "mercedes"
  | "red_bull"
  | "ferrari"
  | "mclaren"
  | "aston_martin"
  | "alpine"
  | "williams"
  | "haas"
  | "audi"
  | "racing_bulls"
  | "cadillac"

export const TEAM_COLORS: Record<TeamId, string> = { 
    mercedes: "#00D2BE",
    red_bull: "#3671C6",
    ferrari: "#E8002D",
    mclaren: "#FF8000",
    aston_martin: "#358C75",
    alpine: "#FF87BC",
    williams: "#64C4FF",
    haas: "#B6BABD",
    audi: "#C0C0C0",
    racing_bulls: "#6692FF",
    cadillac: "#FFFFFF",
}

