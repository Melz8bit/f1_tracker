import { useQuery } from '@tanstack/react-query'
import { fetchDriverStandings } from '../lib/ergast'
import { useStaleTime } from './useSchedule'

// `round` undefined = latest standings
export function useDriverStandings(season: number, round: number | undefined, enabled = true) {
    const staleTime = useStaleTime(season)
    return useQuery({
        queryKey: ['driverStandings', season, round ?? 'latest'],
        queryFn: () => fetchDriverStandings(season, round),
        staleTime,
        enabled,
    })
}
