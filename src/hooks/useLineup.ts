import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDrivers } from '../lib/openf1'
import { constructorIdFromEntry } from '../lib/powerUnits'
import { useOpenF1Season } from './useOpenF1Sessions'
import type { Constructor, DriverStanding } from '../types/f1'

const DAY = 24 * 60 * 60 * 1000

export interface Lineup {
    meetingName: string;
    teamByCode: Map<string, Constructor>; // Driver code (VER, LAW…) → team entered this weekend
}

// Who is driving for whom *this* weekend. Jolpica only learns about a seat swap once a race result
// is published; OpenF1 lists each meeting's entries before practice starts. Used only when viewing
// the latest round — past rounds keep the team each driver actually raced for.
export function useLineup(season: number): Lineup | undefined {
    const { meetings, sessions } = useOpenF1Season(season)
    // Read the clock once per mount (render must stay pure); precise enough to pick the race weekend
    const [now] = useState(() => Date.now())
    // The meeting under way, or the next one if it starts within a week
    const meeting = meetings
        .filter(m => !m.is_cancelled && !/testing/i.test(m.meeting_name))
        .filter(m => Date.parse(m.date_end) + DAY >= now && Date.parse(m.date_start) - 7 * DAY <= now)
        .sort((a, b) => a.date_start.localeCompare(b.date_start))[0]

    // The meeting's latest session has the most up-to-date entry list
    const sessionKey = sessions
        .filter(s => s.meeting_key === meeting?.meeting_key)
        .map(s => s.session_key)
        .sort((a, b) => b - a)[0]

    const { data } = useQuery({
        queryKey: ['lineup', sessionKey],
        queryFn: () => fetchDrivers(sessionKey!),
        enabled: sessionKey !== undefined,
        staleTime: 1000 * 60 * 30,
    })
    if (!meeting || !data?.length) return undefined

    const teamByCode = new Map<string, Constructor>()
    for (const d of data) {
        const constructorId = constructorIdFromEntry(d.team_name)
        if (constructorId) teamByCode.set(d.name_acronym, { constructorId, name: d.team_name, nationality: '' })
    }
    return { meetingName: meeting.meeting_name, teamByCode }
}

// Standings with each driver's team swapped for this weekend's entry, plus who isn't entered
export function applyLineup(standings: DriverStanding[], lineup: Lineup | undefined): Array<DriverStanding & { notEntered?: boolean }> {
    if (!lineup) return standings
    return standings.map(s => {
        const team = lineup.teamByCode.get(s.driver.code)
        return team ? { ...s, constructor: team } : { ...s, notEntered: true }
    })
}
