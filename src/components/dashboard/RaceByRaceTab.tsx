// External Imports
import React from "react"

// Internal Imports
import { useQuery } from "@tanstack/react-query"
import { useFilterStore } from "../../store/filterStore"
import { fetchAllRaces, fetchAllSprints } from "../../lib/ergast"

export default function RaceByRaceTab() {
    const { season, roundMin, roundMax } = useFilterStore()
    const { data, isLoading, error } = useQuery({
        queryKey: ['races', season],
        queryFn: () => fetchAllRaces(season),
        staleTime: 1000 * 60 * 60,
    })

    const {data: sprintData, isLoading: isSprintLoading, error: sprintError} = useQuery({
        queryKey: ['sprints', season],
        queryFn: () => fetchAllSprints(season),
        staleTime: 1000 * 60 * 60,
    })

    if (isLoading || isSprintLoading) return <div className="p-4 text-[#999]">Loading...</div>
    if (error || sprintError) return <div className="p-4 text-[#e10600]">Failed to load races.</div>

    const filtered = data?.filter(race => race.round >= roundMin && race.round <= roundMax) ?? []

    return(
        <div className="p-4 flex flex-col gap-6">
            {filtered.map(race => {
                const sprintRound = sprintData?.find(s => s.round === race.round)
                return (
                    <div key={race.round} className="border border-[#1e1e2e] rounded p-4">
                        <h2 className="text-[#e8e8f0] font-semibold mb-3">
                            Round {race.round} - {race.raceName}
                        </h2>
                        {sprintRound && (
                            <>
                                <h3 className="text-[#999] text-xs font-semibold mb-2 uppercase tracking-wider">Sprint</h3>
                                <table className="w-full text-sm mb-4">
                                    <thead>
                                        <tr className="text-[#666] border-b border-[#1e1e2e]">
                                            <th className="text-left py-1 w-8">POS</th>
                                            <th className="text-left py-1">DRIVER</th>
                                            <th className="text-left py-1">TEAM</th>
                                            <th className="text-right py-1 font-mono">PTS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sprintRound.results.map(result => (
                                            <tr key={result.driver.driverId} className="border-b border-[#1e1e2e]">
                                                <td className="py-1 text-[#666]">{result.position}</td>
                                                <td className="py-1 text-[#e8e8f0]">{result.driver.givenName} {result.driver.familyName}</td>
                                                <td className="py-1 text-[#999]">{result.constructor.name}</td>
                                                <td className="py-1 text-right font-mono text-[#e8e8f0]">{result.points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                        <h3 className="text-[#999] text-xs font-semibold mb-2 uppercase tracking-wider">Grand Prix</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[#666] border-b border-[#1e1e2e]">
                                    <th className="text-left py-1 w-8">POS</th>
                                    <th className="text-left py-1">DRIVER</th>
                                    <th className="text-left py-1">TEAM</th>
                                    <th className="text-right py-1 font-mono">PTS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {race.results.map(result => (
                                    <tr key={result.driver.driverId} className="border-b border-[#1e1e2e]">
                                        <td className="py-1 text-[#666]">{result.position}</td>
                                        <td className="py-1 text-[#e8e8f0]">{result.driver.givenName} {result.driver.familyName}</td>
                                        <td className="py-1 text-[#999]">{result.constructor.name}</td>
                                        <td className="py-1 text-right font-mono text-[#e8e8f0]">{result.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            )}
        </div>
    )
}