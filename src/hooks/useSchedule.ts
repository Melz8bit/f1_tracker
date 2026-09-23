import { useQuery } from '@tanstack/react-query'
import { fetchSchedule } from '../lib/ergast'
import { isRaceWeekend } from '../lib/season'

const HOUR = 1000 * 60 * 60
const FIVE_MINUTES = 1000 * 60 * 5

export function useSchedule(season: number) {
    return useQuery({
        queryKey: ['schedule', season],
        queryFn: () => fetchSchedule(season),
        staleTime: HOUR,
    })
}

// 5 min during a race weekend, 1 hour between races (CLAUDE.md → cache strategy)
export function useStaleTime(season: number): number {
    const { data: schedule } = useSchedule(season)
    return schedule && isRaceWeekend(schedule) ? FIVE_MINUTES : HOUR
}
