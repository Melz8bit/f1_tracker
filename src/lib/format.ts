import type { Driver, ScheduleRace } from '../types/f1'

// Short labels for chart axes. Falls back to the first three letters of the town.
const CIRCUIT_CODES: Record<string, string> = {
    albert_park: 'AUS', shanghai: 'CHN', suzuka: 'JPN', bahrain: 'BHR', jeddah: 'SAU',
    miami: 'MIA', villeneuve: 'CAN', monaco: 'MON', catalunya: 'ESP', red_bull_ring: 'AUT',
    silverstone: 'GBR', spa: 'BEL', hungaroring: 'HUN', zandvoort: 'NED', monza: 'ITA',
    madring: 'MAD', baku: 'AZE', sepang: 'MAL', marina_bay: 'SIN', americas: 'USA',
    rodriguez: 'MEX', interlagos: 'BRA', vegas: 'LVG', losail: 'QAT', yas_marina: 'ABU',
    imola: 'IMO',
}

export function circuitCode(race: Pick<ScheduleRace, 'circuitId' | 'locality'>): string {
    return CIRCUIT_CODES[race.circuitId] ?? race.locality.slice(0, 3).toUpperCase()
}

// "Spanish Grand Prix" → "Spanish GP"
export function shortRaceName(raceName: string): string {
    return raceName.replace('Grand Prix', 'GP')
}

// Drivers known by a name other than their first given name (Jolpica: "Andrea Kimi")
const KNOWN_AS: Record<string, string> = {
    antonelli: 'Kimi',
}

// "K. Antonelli"
export function driverShortName(driver: Driver): string {
    const given = KNOWN_AS[driver.driverId] ?? driver.givenName
    return `${given.charAt(0)}. ${driver.familyName}`
}

// Dates arrive as YYYY-MM-DD; parse as UTC so the day never shifts with the viewer's timezone
function parseDay(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00Z`)
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayOnly = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' })

// "Sep 13"
export function formatDay(isoDate: string): string {
    return monthDay.format(parseDay(isoDate))
}

// "Sep 24–26", or "Oct 30–Nov 1" across a month boundary
export function formatWeekend(race: Pick<ScheduleRace, 'firstPracticeDate' | 'date'>): string {
    if (!race.firstPracticeDate) return formatDay(race.date)
    const start = parseDay(race.firstPracticeDate)
    const end = parseDay(race.date)
    const sameMonth = start.getUTCMonth() === end.getUTCMonth()
    return `${monthDay.format(start)}–${sameMonth ? dayOnly.format(end) : monthDay.format(end)}`
}

// Whole numbers stay whole; half points (shortened races) keep one decimal
export function formatPoints(points: number): string {
    return Number.isInteger(points) ? String(points) : points.toFixed(1)
}
