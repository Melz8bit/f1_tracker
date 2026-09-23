import { create } from 'zustand'

// roundMax at or beyond the last completed round means "latest"
export const LATEST_ROUND = 99

interface FilterState {
    season: number;
    roundMin: number;
    roundMax: number;
    setSeason: (season: number) => void;
    setRoundRange: (min: number, max: number) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
    season: 2026,
    roundMin: 1,
    roundMax: LATEST_ROUND,
    // A new season starts from its full range
    setSeason: (season) => set({ season, roundMin: 1, roundMax: LATEST_ROUND }),
    setRoundRange: (min, max) => set({ roundMin: min, roundMax: max })
}))
