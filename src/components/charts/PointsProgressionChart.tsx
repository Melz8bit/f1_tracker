import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Progression } from '../../lib/progression'

export interface ChartSeries {
    id: string;
    label: string;
    color: string;
    dashed?: boolean; // Second driver of a team shares the colour, so gets a dashed line
}

interface PointsProgressionChartProps {
    progression: Progression;
    series: ChartSeries[];
    roundLabels: Record<number, string>; // round → "AUS"
    height: number;
}

const AXIS_TICK = { fill: '#555', fontSize: 10 }
const GRID = '#1e1e1e'

export default function PointsProgressionChart({ progression, series, roundLabels, height }: PointsProgressionChartProps) {
    // Legend in championship order (Recharts sorts it alphabetically by default)
    const order = new Map(series.map((s, i) => [s.id, i]))
    return (
        <div className="chart-panel">
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={progression.rows} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} />
                    <XAxis
                        dataKey="round"
                        tickFormatter={(round: number) => `R${round} ${roundLabels[round] ?? ''}`}
                        tick={AXIS_TICK}
                        stroke={GRID}
                        interval="preserveStartEnd"
                    />
                    <YAxis tick={AXIS_TICK} stroke={GRID} allowDecimals={false} />
                    <Tooltip
                        contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: '#ccc', marginBottom: 4 }}
                        labelFormatter={(round) => `R${round} ${roundLabels[Number(round)] ?? ''}`}
                        formatter={(value) => `${value} pts`}
                        itemSorter={(item) => -Number(item.value ?? 0)}
                    />
                    <Legend
                        verticalAlign="top"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                        itemSorter={(item) => order.get(String(item.dataKey)) ?? 0}
                        formatter={(value) => <span style={{ color: '#888' }}>{value}</span>}
                    />
                    {series.map(s => (
                        <Line
                            key={s.id}
                            dataKey={s.id}
                            name={s.label}
                            type="monotone"
                            stroke={s.color}
                            strokeWidth={2}
                            strokeDasharray={s.dashed ? '5 3' : undefined}
                            dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
