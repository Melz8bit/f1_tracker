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

export function teamColor(constructorId: string): string {
    return TEAMS[constructorId]?.color ?? FALLBACK_COLOR
}
