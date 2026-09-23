import { useQuery } from '@tanstack/react-query'
import { fetchPoles } from '../lib/ergast'
import { useStaleTime } from './useSchedule'

export function usePoles(season: number) {
    const staleTime = useStaleTime(season)
    return useQuery({
        queryKey: ['poles', season],
        queryFn: () => fetchPoles(season),
        staleTime,
    })
}
