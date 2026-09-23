import { buildSeasonState } from '../lib/season'
import { useFilterStore } from '../store/filterStore'
import { useRaceResults } from './useRaceResults'
import { useSchedule } from './useSchedule'

// Schedule + all results for the selected season, reduced to "where are we in the season"
export function useSeason() {
    const { season, roundMax } = useFilterStore()
    const schedule = useSchedule(season)
    const { races, sprints } = useRaceResults(season)

    const isLoading = schedule.isLoading || races.isLoading || sprints.isLoading
    const error = schedule.error ?? races.error ?? sprints.error
    const state = schedule.data && races.data && sprints.data
        ? buildSeasonState(schedule.data, races.data, sprints.data, roundMax)
        : undefined

    return {
        season,
        state,
        schedule: schedule.data ?? [],
        races: races.data ?? [],
        sprints: sprints.data ?? [],
        isLoading,
        error,
    }
}
