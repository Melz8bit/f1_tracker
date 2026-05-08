// External Imports
import React from "react";
import { useQuery } from "@tanstack/react-query";

// Internal Imports
import { useFilterStore } from "../../store/filterStore";
import { fetchDriverStandings } from "../../lib/ergast";


export default function StandingsTab() {
    const { season } = useFilterStore()

    const { data, isLoading, error } = useQuery({
        queryKey: ['driverStandings', season],
        queryFn: () => fetchDriverStandings(season),
        staleTime: 1000 * 60 * 60,
    })

    if (isLoading) return <div className="p-4 text-[#999]">Loading...</div>
    if (error) return <div className="p-4 text-[#e10600]">Failed to load standings.</div>

    return (
        <div className="p-4">
            <table className="w-full text-sm">
            <thead>
                <tr className="text-[#666] border-b border-[#1e1e2e]">
                    <th className="text-left py-2 w-20">POS</th>
                    <th className="text-left py-2">DRIVER</th>
                    <th className="text-left py-2">TEAM</th>
                    <th className="text-right py-2 font-mono">PTS</th>
                </tr>
            </thead>
            <tbody>
                {data?.map((entry) => (
                    <tr key={entry.driver.driverId} className="border-b border-[#1e1e2e] hover:bg-[#111118]">
                        <td className="py-2 text-left text-[#666]">{entry.position}</td>
                        <td className="py-2 text-left text-[#e8e8f0]">
                            {entry.driver.givenName} {entry.driver.familyName}
                        </td>
                        <td className="py-2 text-left text-[#999]">{entry.constructor.name}</td>
                        <td className="py-2 text-right font-mono text-[#e8e8f0]">{entry.points}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        </div>
    )
}