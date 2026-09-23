import type { Constructor } from '../types/f1'

// Display names + colours, keyed by Jolpica constructorId. Colours follow the design reference
// (f1_2026_dashboard.html), not the official liveries — they're tuned for the dark UI.
const TEAMS: Record<string, { name: string; color: string }> = {
    mercedes:     { name: 'Mercedes',     color: '#888880' },
    ferrari:      { name: 'Ferrari',      color: '#cc2200' },
    mclaren:      { name: 'McLaren',      color: '#e8621a' },
    red_bull:     { name: 'Red Bull',     color: '#1a5fbb' },
    alpine:       { name: 'Alpine',       color: '#e04488' },
    haas:         { name: 'Haas',         color: '#aaaaaa' },
    rb:           { name: 'Racing Bulls', color: '#7766ee' },
    williams:     { name: 'Williams',     color: '#1155aa' },
    audi:         { name: 'Audi',         color: '#77aa22' },
    cadillac:     { name: 'Cadillac',     color: '#999999' },
    aston_martin: { name: 'Aston Martin', color: '#336611' },
    // Earlier seasons
    sauber:       { name: 'Sauber',       color: '#52a352' },
    alphatauri:   { name: 'AlphaTauri',   color: '#5566aa' },
    alfa:         { name: 'Alfa Romeo',   color: '#992222' },
}

const FALLBACK_COLOR = '#888888'

export function teamName(constructor: Constructor): string {
    return TEAMS[constructor.constructorId]?.name ?? constructor.name.replace(/ F1 Team$/, '')
}

// When only the id is known (e.g. keys in generated data files)
export function teamNameById(constructorId: string): string {
    return TEAMS[constructorId]?.name ?? constructorId
}

// 2026 power unit suppliers. Phase 4's FIA scraper can replace this with the entry names
// ("Red Bull Racing RB Ford", "Haas Ferrari", …).
const POWER_UNITS_2026: Record<string, string> = {
    mercedes: 'Mercedes', mclaren: 'Mercedes', alpine: 'Mercedes', williams: 'Mercedes',
    ferrari: 'Ferrari', haas: 'Ferrari', cadillac: 'Ferrari',
    red_bull: 'RB Powertrains/Ford', rb: 'RB Powertrains/Ford',
    audi: 'Audi', aston_martin: 'Honda',
}

export function powerUnit(season: number, constructorId: string): string | undefined {
    return season === 2026 ? POWER_UNITS_2026[constructorId] : undefined
}

export function teamColor(constructorId: string): string {
    return TEAMS[constructorId]?.color ?? FALLBACK_COLOR
}
