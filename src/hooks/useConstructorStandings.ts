import { useQuery } from '@tanstack/react-query'
import { fetchConstructorStandings } from '../lib/ergast'
import { useStaleTime } from './useSchedule'

// `round` undefined = latest standings
export function useConstructorStandings(season: number, round: number | undefined, enabled = true) {
    const staleTime = useStaleTime(season)
    return useQuery({
        queryKey: ['constructorStandings', season, round ?? 'latest'],
        queryFn: () => fetchConstructorStandings(season, round),
        staleTime,
        enabled,
    })
}
