import { useQuery } from '@tanstack/react-query'
import paceRatingsJson from '../data/paceRatings.json'
import type { RoundPace, SeasonPace } from '../lib/pace'

const bundled = paceRatingsJson as unknown as Record<string, SeasonPace | undefined>

// Pace ratings: the committed file plus rounds /api/pace has computed since (new races, automatically).
// Locally (`npm run dev`) there is no /api, so this falls back to the committed file.
export function usePaceRatings(season: number): Record<string, RoundPace> {
    const fallback = bundled[season]?.rounds ?? {}
    const { data } = useQuery({
        queryKey: ['pace', season],
        queryFn: async (): Promise<Record<string, RoundPace>> => {
            try {
                const res = await fetch(`/api/pace?season=${season}`)
                if (!res.ok || !res.headers.get('content-type')?.includes('json')) return fallback
                return { ...fallback, ...((await res.json()) as { rounds: Record<string, RoundPace> }).rounds }
            } catch {
                return fallback
            }
        },
        staleTime: 1000 * 60 * 30,
    })
    return data ?? fallback
}
