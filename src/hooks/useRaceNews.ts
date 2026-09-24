import { useQuery } from '@tanstack/react-query'
import raceNewsJson from '../data/raceNews.json'
import type { NewsFile, RoundNews } from '../lib/news'

const bundled = raceNewsJson as NewsFile

interface NewsResponse {
    rounds: Record<string, RoundNews>;
    generating: number | null; // Round being summarized right now, if any
}

// Press summaries: the committed file, plus anything the /api/news function has summarized since.
// Calling the function is also what triggers summarizing a newly finished race (once, server-side).
// Locally (`npm run dev`) there is no /api, so this falls back to the committed file.
export function useRaceNews(season: number) {
    const fallback: NewsResponse = { rounds: (bundled[season] ?? {}) as Record<string, RoundNews>, generating: null }
    const query = useQuery({
        queryKey: ['raceNews', season],
        queryFn: async (): Promise<NewsResponse> => {
            try {
                const res = await fetch(`/api/news?season=${season}`)
                if (!res.ok || !res.headers.get('content-type')?.includes('json')) return fallback
                const data = (await res.json()) as NewsResponse
                return { rounds: { ...fallback.rounds, ...data.rounds }, generating: data.generating }
            } catch {
                return fallback
            }
        },
        staleTime: 1000 * 60 * 5,
        // While a race is being summarized, check back until it lands
        refetchInterval: q => (q.state.data?.generating ? 60_000 : false),
    })
    return query.data ?? fallback
}
