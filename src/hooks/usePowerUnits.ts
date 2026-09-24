import { useQuery } from '@tanstack/react-query'
import powerUnitsJson from '../data/powerUnits.json'
import type { PUFile, RoundPU } from '../lib/powerUnits'

const bundled = powerUnitsJson as PUFile

// Power unit usage: the committed file plus anything /api/power-units has read from fia.com since.
// Locally (`npm run dev`) there is no /api, so this falls back to the committed file.
export function usePowerUnits(season: number): Record<string, RoundPU> {
    const fallback = bundled[season]?.rounds ?? {}
    const { data } = useQuery({
        queryKey: ['powerUnits', season],
        queryFn: async (): Promise<Record<string, RoundPU>> => {
            try {
                const res = await fetch(`/api/power-units?season=${season}`)
                if (!res.ok || !res.headers.get('content-type')?.includes('json')) return fallback
                return { ...fallback, ...((await res.json()) as { rounds: Record<string, RoundPU> }).rounds }
            } catch {
                return fallback
            }
        },
        staleTime: 1000 * 60 * 30,
    })
    return data ?? fallback
}
