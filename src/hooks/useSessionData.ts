import { useQuery } from '@tanstack/react-query'
import { fetchDrivers, fetchOvertakes, fetchRaceControl, fetchStints, fetchWeather } from '../lib/openf1'
import type { SessionData } from '../lib/raceFacts'

// Everything the race-facts bullets need for one session. Fetched only when a race row is opened;
// the OpenF1 client queues the five calls so they don't trip the rate limit.
export function useSessionData(sessionKey: number | undefined) {
    return useQuery({
        queryKey: ['sessionData', sessionKey],
        queryFn: async (): Promise<SessionData> => {
            const key = sessionKey!
            const [drivers, raceControl, stints, weather, overtakes] = await Promise.all([
                fetchDrivers(key), fetchRaceControl(key), fetchStints(key), fetchWeather(key), fetchOvertakes(key),
            ])
            return { drivers, raceControl, stints, weather, overtakes }
        },
        enabled: sessionKey !== undefined,
        staleTime: 1000 * 60 * 60,
    })
}
