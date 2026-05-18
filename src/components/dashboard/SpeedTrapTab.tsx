import React from "react";

import { useQuery } from "@tanstack/react-query";
import { useFilterStore } from "../../store/filterStore";
import { fetchSessions, fetchDrivers, fetchAllLaps } from "../../lib/openf1";

export default function SpeedTrapTab() {
    const { season, roundMax } = useFilterStore()
    
    const { data: sessions } = useQuery({
        queryKey: ['sessions', season],
        queryFn: () => fetchSessions(season),
        staleTime: 1000 * 60 * 60,
    })
    
    const now = new Date()
    const raceSession = sessions
        ?.filter(s => s.session_type == 'Race' && new Date(s.date_start) < now)
        .at(-1)

    const { data: drivers } = useQuery({
        queryKey: ['drivers', raceSession?.session_key],
        queryFn: () => fetchDrivers(raceSession!.session_key),
        enabled: !!raceSession,
        staleTime: 1000 * 60 * 60
    })

    /*
        - useQueries takes an object with a queries array — each item is a regular query config
        -(drivers ?? []).map(...) — if drivers is undefined, use empty array so we don't crash before data loads
        - Each query key includes driver_number so each driver gets its own cache entry
        - enabled: !!raceSession && !!drivers — both must exist before any car data fetches fire
        - carDataResults is an array of query results, one per driver — not a single { data, isLoading } object
    */
    
    // REMOVED: API has rate-limiting
    // const carDataResults = useQueries({
    //     queries: (drivers ?? []).map(driver => ({
    //         queryKey: ['laps', raceSession?.session_key, driver.driver_number],
    //         queryFn: () => fetchLaps(raceSession!.session_key, driver.driver_number),
    //         enabled: !!raceSession?.session_key,
    //         staleTime: 1000 * 60 * 60,
    //     }))
    // })

    const { data: allLaps } = useQuery({
        queryKey: ['laps', raceSession?.session_key],
        queryFn: () => fetchAllLaps(raceSession!.session_key),
        enabled: !!raceSession?.session_key,
        staleTime: 100 * 60 * 60,
    })

    const isLoading = !raceSession || !drivers || !allLaps
    const hasError = false

    const speedData = (drivers ?? [])
        .map(driver => {
            const driverLaps = allLaps?.filter(l => l.driver_number == driver.driver_number) ?? []
            const speeds = driverLaps.map(l => l.st_speed).filter((s): s is number => s != null)
            const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0
            return { driver, maxSpeed }
        })
        .filter(entry => entry.maxSpeed > 0)
        .sort((a, b) => b.maxSpeed - a.maxSpeed)

    if (isLoading) return <div className="p-4 text-[#999]">Loading...</div>
    if (hasError) return <div className="p-4 text-[#e10600]">Failed to load speed info.</div>

    return (
        <div className="p-4">
            <h2 className="text-[#e8e8f0] font-semibold mb-4">
                Top Speeds - {raceSession.circuit_short_name} {raceSession.year}
            </h2>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-[#666] border-b border-[#1e1e2e]">
                        <th className="py-1 w-8">POS</th>
                        <th className="py-1">DRIVER</th>
                        <th className="py-1">TEAM</th>
                        <th className="text-right py-1 font-mono">KM/H</th>
                    </tr>
                </thead>
                <tbody>
                    {speedData.map((entry, i) => (
                        <tr key={entry.driver.driver_number} className="border-b border-[#1e1e2e]">
                            <td className="py-1 text-[#666] w-8">{i + 1}</td>
                            <td className="py-1 text-[#e8e8f0]">{entry.driver.full_name}</td>
                            <td className="py-1 text-[#999]">{entry.driver.team_name}</td>
                            <td className="py-1 text-right font-mono text-[#e8e8f0]">{entry.maxSpeed}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}