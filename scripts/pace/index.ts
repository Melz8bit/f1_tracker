// Computes team pace ratings from OpenF1 timing + telemetry and writes src/data/paceRatings.json.
// Normally not needed: the deployed /api/pace function adds each new round automatically.
//
//   npm run pace                  → current season, only rounds not yet in the file
//   npm run pace -- 2026 --force  → recompute every round
//   npm run pace -- 2026 --round 14
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { jolpica, openF1 } from '../lib/api.ts'
import type { RoundPace, SeasonPace } from '../../src/lib/pace.ts'
import { computeRound, fetchRaceTeams, fetchSessionIndex, findSessions, type PaceDeps } from './compute.ts'

const OUTPUT = join(import.meta.dirname, '..', '..', 'src', 'data', 'paceRatings.json')

const deps: PaceDeps = {
    openF1: path => openF1(path, !/\/(meetings|sessions)\?/.test(path)), // Session lists change; data doesn't
    jolpica: path => jolpica(path),
}

async function save(output: Record<string, SeasonPace>, season: number, rounds: Record<string, RoundPace>) {
    output[season] = { generatedAt: new Date().toISOString(), rounds }
    await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n')
}

async function main() {
    const args = process.argv.slice(2)
    const season = parseInt(args.find(a => /^\d{4}$/.test(a)) ?? String(new Date().getFullYear()))
    const force = args.includes('--force')
    const onlyRound = args.includes('--round') ? parseInt(args[args.indexOf('--round') + 1]) : undefined

    let output: Record<string, SeasonPace> = {}
    try {
        output = JSON.parse(await readFile(OUTPUT, 'utf8'))
    } catch {
        // First run
    }
    const existing = output[season]?.rounds ?? {}
    const [results, index] = await Promise.all([fetchRaceTeams(deps, season), fetchSessionIndex(deps, season)])

    const rounds: Record<string, RoundPace> = { ...existing }
    for (const [round, race] of [...results].sort((a, b) => a[0] - b[0])) {
        if (race.teams.size === 0) continue
        if (onlyRound !== undefined && round !== onlyRound) continue
        if (!force && onlyRound === undefined && existing[round]) continue

        const sessions = findSessions(index, race)
        if (!sessions) {
            console.warn(`R${round} ${race.raceName}: no OpenF1 qualifying/race session, skipped`)
            continue
        }
        process.stdout.write(`R${round} ${race.raceName}… `)
        const pace = await computeRound(deps, race, sessions)
        rounds[round] = pace
        console.log(`${Object.keys(pace.gaps.quali).length} teams, corners ${pace.corners.slow} slow / ${pace.corners.high} high`)
        // Save after every round so an interrupted run keeps its progress
        await save(output, season, rounds)
    }

    await save(output, season, rounds)
    console.log(`Wrote ${Object.keys(rounds).length} rounds for ${season} → src/data/paceRatings.json`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
