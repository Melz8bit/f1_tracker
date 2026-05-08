import { create } from 'zustand'

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
    roundMax: 24,
    setSeason: (season) => set({ season }),
    setRoundRange: (min, max) => set({ roundMin: min, roundMax: max })
}))

