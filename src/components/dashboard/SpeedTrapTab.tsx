import React from "react";

import { useQuery, useQueries } from "@tanstack/react-query";
import { useFilterStore } from "../../store/filterStore";
import { fetchSessions, fetchDrivers, fetchCarData } from "../../lib/openf1";

export default function SpeedTrapTab() {
    const { season, roundMax } = useFilterStore()
    
    const { data: sessions } = useQuery({
        queryKey: ['sessions', season],
        queryFn: () => fetchSessions(season),
        staleTime: 1000 * 60 * 60,
    })
    
    const raceSession = sessions?.filter(s => s.session_type === 'Race')
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
    const carDataResults = useQueries({
        queries: (drivers ?? []).map(driver => ({
            queryKey: ['carData', raceSession?.session_key, driver.driver_number],
            queryFn: () => fetchCarData(raceSession!.session_key, driver.driver_number),
            enabled: !!raceSession?.session_key,
            staleTime: 1000 * 60 * 60,
        }))
    })
}