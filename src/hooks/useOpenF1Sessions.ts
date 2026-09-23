import { useQuery } from '@tanstack/react-query'
import { fetchMeetings, fetchSessions, type OpenF1Meeting, type OpenF1Session } from '../lib/openf1'

const HOUR = 1000 * 60 * 60
export const FIRST_OPENF1_SEASON = 2023

// Meetings + sessions for a season: 2 requests, reused by every race row
export function useOpenF1Season(season: number) {
    const enabled = season >= FIRST_OPENF1_SEASON
    const meetings = useQuery({
        queryKey: ['openf1Meetings', season],
        queryFn: () => fetchMeetings(season),
        staleTime: HOUR,
        enabled,
    })
    const sessions = useQuery({
        queryKey: ['openf1Sessions', season],
        queryFn: () => fetchSessions(season),
        staleTime: HOUR,
        enabled,
    })
    return { meetings: meetings.data ?? [], sessions: sessions.data ?? [] }
}

const day = (iso: string) => iso.slice(0, 10)

// Jolpica round → OpenF1 session, matched on the race date falling inside the meeting's dates
export function findSession(
    meetings: OpenF1Meeting[],
    sessions: OpenF1Session[],
    raceDate: string,
    sessionName: 'Race' | 'Sprint',
): OpenF1Session | undefined {
    const meeting = meetings.find(m => !m.is_cancelled && day(m.date_start) <= raceDate && raceDate <= day(m.date_end))
    if (!meeting) return undefined
    return sessions.find(s => s.meeting_key === meeting.meeting_key && s.session_name === sessionName)
}

export function cancelledMeetings(meetings: OpenF1Meeting[]): OpenF1Meeting[] {
    return meetings.filter(m => m.is_cancelled && !m.meeting_name.toLowerCase().includes('testing'))
}
