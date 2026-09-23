import { useQuery } from '@tanstack/react-query'
import { fetchAllRaces, fetchAllSprints } from '../lib/ergast'
import { useStaleTime } from './useSchedule'

export function useRaceResults(season: number) {
    const staleTime = useStaleTime(season)
    const races = useQuery({
        queryKey: ['races', season],
        queryFn: () => fetchAllRaces(season),
        staleTime,
    })
    const sprints = useQuery({
        queryKey: ['sprints', season],
        queryFn: () => fetchAllSprints(season),
        staleTime,
    })
    return { races, sprints }
}
