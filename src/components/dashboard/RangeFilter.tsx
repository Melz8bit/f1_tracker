// External Imports
import React from 'react'

// Internal Imports
import { useFilterStore } from '../../store/filterStore'

// Relative Imports (files nearby in the folder structure)


export default function RangeFilter() {
    const { season, roundMin, roundMax, setSeason, setRoundRange } = useFilterStore()

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-3">
                <label className='text-sm text-[#999]'>Season</label>
                <select
                    value={season}
                    onChange={(e) => setSeason(Number(e.target.value))}
                    className='bg-[#111118] border border-[#1e1e2e] text-[#e8e8f0] rounded px-2 py-1 text-sm'
                >
                    {[2026, 2025, 2024, 2023].map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            <div className='flex flex-col gap-2'>
                <label className='text-sm text-[#999]'>
                    Rounds {roundMin}-{roundMax}
                </label>
                <input
                    type='range'
                    min={1}
                    max={24}
                    value={roundMax}
                    onChange={(e) => setRoundRange(roundMin, Number(e.target.value))}
                    className='accent-[#e10600]'
                />
            </div>
        </div>
    )
}