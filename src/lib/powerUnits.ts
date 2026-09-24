// Power unit element usage (src/data/powerUnits.json + /api/power-units), from the FIA's
// Technical Delegate reports and stewards' decisions.

export const ELEMENTS = ['ICE', 'TC', 'EXH', 'MGU-K', 'ES', 'PU-CE', 'PU-ANC'] as const
export type Element = typeof ELEMENTS[number]

export const ELEMENT_NAMES: Record<Element, string> = {
    ICE: 'Engine',
    TC: 'Turbocharger',
    EXH: 'Exhaust',
    'MGU-K': 'MGU-K',
    ES: 'Energy store',
    'PU-CE': 'Control electronics',
    'PU-ANC': 'Ancillaries',
}

// Per-driver season allocation. 2026 Sporting Regulations B8.2.2 (ICE/TC/EXH 3, ES/PU-CE/MGU-K 2,
// PU-ANC 5) plus one of each for the 2026 Championship (B8.2.3a). Going over: 10 grid places the first
// time for each element type, 5 for each one after (B8.2.8).
export const LIMITS: Record<number, Record<Element, number>> = {
    2026: { ICE: 4, TC: 4, EXH: 4, 'MGU-K': 3, ES: 3, 'PU-CE': 3, 'PU-ANC': 6 },
}

export interface DriverPU {
    car: number;
    driver: string;
    team: string; // FIA entry name, e.g. "Red Bull Racing RB Ford"
    constructorId?: string;
    counts: Record<Element, number>; // Cumulative, after this weekend's new elements
}

export interface PUPenalty {
    car: number;
    driver: string;
    elements: Array<{ element: Element; nth: number }>;
    decision: string;
    gridDrop?: number;
    pitLane: boolean;
    url: string;
}

export interface RoundPU {
    event: string;
    drivers: DriverPU[];
    penalties: PUPenalty[];
    sources: string[]; // FIA document URLs
}

export interface SeasonPU {
    checkedAt: string;
    rounds: Record<string, RoundPU>;
}

export type PUFile = Record<string, SeasonPU | undefined>

// FIA entry name → Jolpica constructorId. Matched anywhere in the name ("Atlassian Williams Mercedes"),
// team before engine supplier, so "McLaren Mercedes" is McLaren and "Haas Ferrari" is Haas.
const TEAM_PREFIXES: Array<[string, string]> = [
    ['Racing Bulls', 'rb'], ['Red Bull', 'red_bull'], ['Aston Martin', 'aston_martin'], ['McLaren', 'mclaren'],
    ['Williams', 'williams'], ['Alpine', 'alpine'], ['Haas', 'haas'], ['Cadillac', 'cadillac'],
    ['Audi', 'audi'], ['Ferrari', 'ferrari'], ['Mercedes', 'mercedes'],
]

export function constructorIdFromEntry(team: string): string | undefined {
    return TEAM_PREFIXES.find(([name]) => team.includes(name))?.[1]
}

// Supplier from the entry name: "McLaren Mercedes" → "Mercedes", "Red Bull Racing RB Ford" → "RB Ford"
export function supplierFromEntry(team: string): string {
    if (/Honda$/.test(team)) return 'Honda'
    if (/RB Ford$/.test(team)) return 'RB Ford'
    const last = team.split(' ').pop() ?? team
    return ['Mercedes', 'Ferrari', 'Audi'].includes(last) ? last : team
}
