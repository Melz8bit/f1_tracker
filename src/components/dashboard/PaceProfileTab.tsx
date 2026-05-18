import React from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useFilterStore } from "../../store/filterStore";
import paceRatings from "../../data/paceRatings.json"

interface CustomBarProps {
    x: number
    y: number
    width: number
    height: number
    team: string
    payload: { team: string, avg: number }
}

export default function PaceProfileTab() {
    const TEAM_COLORS: Record<string, string> = {
        mercedes: '#00D2BE',
        red_bull: '#3671C6',
        ferrari: '#E8002D',
        mclaren: '#FF8000',
        aston_martin: '#358C75',
        alpine: '#FF87BC',
        williams: '#64C4FF',
        haas: '#B6BABD',
        audi: '#C0C0C0',
        racing_bulls: '#6692FF',
        cadillac: '#FFFFFF',
    }

    const { season, roundMin, roundMax } = useFilterStore()

    const seasonData = (paceRatings as Record<string, Record<string, Record<string, Record<string, number>>>>)[season]

    const teams = seasonData ? Object.keys(Object.values(seasonData)[0]) : []

    const chartData = teams.map(team => {
        const rounds = Object.entries(seasonData ?? {})
            .filter(([round]) => {
                const r = parseInt(round)
                return r >= roundMin && r <= roundMax
            })
        
        const avg = rounds.reduce((sum, [, teamData]) => sum + (teamData[team]?.race ?? 0), 0) / (rounds.length || 1)
        return { team, avg: Math.round(avg), color: TEAM_COLORS[team] ?? '#666' }
    }).sort((a, b) => b.avg - a.avg)

    return <div>
        <div className="p-4">
            <h2 className="text-[#e8e8f0] font-semibold mb-4">
                Race Pace - Rounds {roundMin}-{roundMax}
            </h2>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                    <XAxis
                        dataKey="team"
                        tick={{ fill: '#999', fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                    />
                    <YAxis
                        domain={[40, 100]}
                        tick={{ fill: '#999', fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', color: '#e8e8f0' }}
                    />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                        {chartData.map(entry => (
                            <Cell key={entry.team} fill={TEAM_COLORS[entry.team] ?? '#666'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
}