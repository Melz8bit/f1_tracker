// Manual runs of the news pipeline. Normally not needed: the deployed site's /api/news function
// summarizes each new race automatically. Use this to regenerate a round or preview what would be sent.
//
//   npm run news -- 2026 --round 14   → (re)generate one round into src/data/raceNews.json
//   npm run news -- --dry-run         → collect + extract only; prints what would be sent (no API key needed)
//
// Needs ANTHROPIC_API_KEY (read from .env.local) unless --dry-run.
import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { openF1, webPage } from '../lib/api.ts'
import type { NewsFile } from '../../src/lib/news.ts'
import { MIN_ARTICLES, collectListings, loadSeason, prepareWeekend, summarizeRound, weekendWindow, type PipelineDeps } from './pipeline.ts'
import { formatArticles } from './summarize.ts'

const OUTPUT = join(import.meta.dirname, '..', '..', 'src', 'data', 'raceNews.json')

const deps: PipelineDeps = {
    page: (url, fresh) => webPage(url, !fresh),
    openF1: path => openF1(path),
    log: message => console.warn(message),
}

async function main() {
    const args = process.argv.slice(2)
    const season = parseInt(args.find(a => /^\d{4}$/.test(a)) ?? String(new Date().getFullYear()))
    const dryRun = args.includes('--dry-run')
    const roundArg = args.includes('--round') ? parseInt(args[args.indexOf('--round') + 1]) : undefined

    const data = await loadSeason(deps, season)
    const round = roundArg ?? Math.max(0, ...data.races.filter(r => r.results.length > 0).map(r => r.round))
    const info = data.schedule.find(r => r.round === round)
    if (!info) throw new Error(`No round ${round} in ${season}`)

    console.log(`Collecting listings from news sites…`)
    const listings = await collectListings(deps, weekendWindow(info)[0])
    const inputs = await prepareWeekend(deps, data, round, listings)
    console.log(`R${round} ${info.raceName}: ${inputs.articles.length} articles (${[...new Set(inputs.articles.map(a => a.site))].join(', ') || 'none'}), ${inputs.links.length} links`)

    if (dryRun) {
        for (const a of inputs.articles) console.log(`   [${a.id}] ${a.site} ${a.published} ${a.text.length} chars — ${a.title}`)
        console.log(`   prompt ≈ ${Math.round((inputs.data.length + formatArticles(inputs.articles, 12_000).length) / 4)} tokens`)
        return
    }
    if (inputs.articles.length < MIN_ARTICLES) throw new Error('Too little coverage found — nothing written')

    const news = await summarizeRound(new Anthropic(), inputs)
    let output: NewsFile = {}
    try {
        output = JSON.parse(await readFile(OUTPUT, 'utf8'))
    } catch {
        // First run
    }
    output[season] = { ...output[season], [round]: news }
    await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n')
    console.log(`   ${news.bullets.length} bullets, ${news.quotes.length} verified quotes → src/data/raceNews.json`)
}

main().catch(err => {
    if (err instanceof Anthropic.AuthenticationError) console.error('Anthropic API key missing or invalid — add ANTHROPIC_API_KEY to .env.local')
    else console.error(err)
    process.exit(1)
})
