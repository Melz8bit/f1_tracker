// Builds src/data/powerUnits.json from the FIA's documents for every event so far.
// Normally not needed after the first run: the deployed /api/power-units function picks up new events.
//
//   npm run pu              → current season
//   npm run pu -- 2026
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pdfFile, webPage } from '../lib/api.ts'
import type { PUFile, RoundPU } from '../../src/lib/powerUnits.ts'
import { listEvents, readEvent, type CrawlDeps } from './crawl.ts'

const OUTPUT = join(import.meta.dirname, '..', '..', 'src', 'data', 'powerUnits.json')

const deps: CrawlDeps = {
    text: url => webPage(url, false), // Event pages gain documents all weekend — always fresh
    bytes: url => pdfFile(url),
    log: message => console.warn(message),
}

async function main() {
    const season = parseInt(process.argv.slice(2).find(a => /^\d{4}$/.test(a)) ?? String(new Date().getFullYear()))
    const events = await listEvents(deps, season)
    console.log(`${events.length} FIA events for ${season}`)

    const rounds: Record<string, RoundPU> = {}
    for (const event of events) {
        const result = await readEvent(deps, event)
        if (!result) {
            console.log(`  ${event.name}: no PU report yet`)
            continue
        }
        rounds[result.round] = result.data
        console.log(`  R${result.round} ${event.name}: ${result.data.drivers.length} drivers, ${result.data.penalties.length} penalties`)
    }

    let output: PUFile = {}
    try {
        output = JSON.parse(await readFile(OUTPUT, 'utf8'))
    } catch {
        // First run
    }
    output[season] = { checkedAt: new Date().toISOString(), rounds }
    await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n')
    console.log(`Wrote ${Object.keys(rounds).length} rounds → src/data/powerUnits.json`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
