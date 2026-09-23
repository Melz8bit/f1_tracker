// Internal Imports
import { useFilterStore, LATEST_ROUND } from '../../store/filterStore'
import { useSeason } from '../../hooks/useSeason'

const FIRST_SEASON = 2021
const seasons = Array.from({ length: new Date().getFullYear() - FIRST_SEASON + 1 }, (_, i) => new Date().getFullYear() - i)

export default function RangeFilter() {
    const { season, roundMin, roundMax, setSeason, setRoundRange } = useFilterStore()
    const { state } = useSeason()

    const roundsDone = state?.roundsDone ?? 0
    const to = Math.min(roundMax, roundsDone)
    const from = Math.min(roundMin, to)
    const canSlide = roundsDone > 1

    // Dragging "to" back to the last completed round re-attaches to "latest", so new races appear
    const setTo = (value: number) => setRoundRange(Math.min(roundMin, value), value >= roundsDone ? LATEST_ROUND : value)
    const setFrom = (value: number) => setRoundRange(value, Math.max(roundMax, value))

    return (
        <div className="filter-bar mb-5">
            <label className="flex items-center gap-2">
                Season
                <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
                    {seasons.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </label>

            {canSlide && (
                <>
                    <label className="flex items-center gap-2">
                        From R{from}
                        <input type="range" min={1} max={roundsDone} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
                    </label>
                    <label className="flex items-center gap-2">
                        To R{to}
                        <input type="range" min={1} max={roundsDone} value={to} onChange={(e) => setTo(Number(e.target.value))} />
                    </label>
                    <span className="text-[#444]">{to === roundsDone ? 'Latest' : `Looking back from R${roundsDone}`}</span>
                </>
            )}
        </div>
    )
}
