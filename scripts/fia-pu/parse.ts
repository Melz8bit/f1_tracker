// Parsers for the FIA's power unit documents. Text is read with pdf.js and regrouped into visual rows
// by y-position (plain text extraction merges table columns, e.g. "4 3" becomes "43").
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
// Loading the worker up front registers it on globalThis, so pdf.js runs it in-process instead of
// dynamically importing it later (which Vercel's file tracing could miss)
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { ELEMENTS, type Element } from '../../src/lib/powerUnits.ts'

type Row = string[] // Cells left to right

async function pdfRows(data: Uint8Array): Promise<Row[]> {
    const doc = await getDocument({ data, verbosity: 0 }).promise
    const rows: Row[] = []
    for (let p = 1; p <= doc.numPages; p++) {
        const { items } = await (await doc.getPage(p)).getTextContent()
        const byY = new Map<number, Array<[number, string]>>()
        for (const item of items) {
            if (!('str' in item) || !item.str.trim()) continue
            const y = Math.round(item.transform[5])
            byY.set(y, [...(byY.get(y) ?? []), [item.transform[4], item.str.trim()]])
        }
        for (const [, cells] of [...byY].sort((a, b) => b[0] - a[0])) rows.push(cells.sort((a, b) => a[0] - b[0]).map(c => c[1]))
    }
    return rows
}

const joined = (rows: Row[]) => rows.map(r => r.join(' ')).join('\n')

// "Enclosed 14 ESP GP 26 TDR01.pdf" → 14, "07 BCN-CAT GP 26 TDR1.pdf" → 7
function roundFromEnclosure(text: string): number | undefined {
    const match = text.match(/Enclosed\s+(\d{1,2})\s+[A-Z-]+\s+GP/)
    return match ? Number(match[1]) : undefined
}

export interface DriverUsage {
    car: number;
    team: string; // As the FIA writes it: "McLaren Mercedes", "Red Bull Racing RB Ford"
    driver: string;
    counts: Record<Element, number>;
}

// "PU Elements used per Driver up to now" — cumulative counts at the start of the weekend
export async function parseUsageReport(data: Uint8Array): Promise<{ round?: number; drivers: DriverUsage[] }> {
    const rows = await pdfRows(data)
    const drivers: DriverUsage[] = []
    // A long entry name ("Atlassian Williams Mercedes") can wrap onto its own line above or below the row
    // (sometimes split across both); skip the table header
    const isTextOnly = (row: Row | undefined): row is Row =>
        !!row && row.every(cell => !/\d/.test(cell)) && !row.some(cell => /^(Car|Driver)$/.test(cell))
    for (const [i, row] of rows.entries()) {
        // 81 | McLaren Mercedes | Oscar Piastri | 4 | 3 | 3 | 2 | 2 | 2 | 4
        if (row.length < 2 + ELEMENTS.length || !/^\d{1,2}$/.test(row[0])) continue
        const numbers = row.slice(-ELEMENTS.length)
        if (!numbers.every(n => /^\d+$/.test(n))) continue
        const names = row.slice(1, -ELEMENTS.length)
        const wrapped = [rows[i - 1], rows[i + 1]].filter(isTextOnly).flat()
        drivers.push({
            car: Number(row[0]),
            team: names.length > 1 ? names.slice(0, -1).join(' ') : wrapped.join(' '),
            driver: names[names.length - 1],
            counts: Object.fromEntries(ELEMENTS.map((e, i) => [e, Number(numbers[i])])) as Record<Element, number>,
        })
    }
    return { round: roundFromEnclosure(joined(rows)), drivers }
}

// Element names as written in the FIA's prose, mapped to our codes
function elementFromText(text: string): Element | undefined {
    const code = text.match(/\((ICE|TC|EXH?|MGU-K|ES|PU-CE|CE|PU-ANC|ANC)\)/)?.[1]
    if (code) return ({ EX: 'EXH', CE: 'PU-CE', ANC: 'PU-ANC' } as Record<string, Element>)[code] ?? (code as Element)
    if (/MGU-K/i.test(text)) return 'MGU-K'
    return undefined
}

export interface NewElement {
    car: number;
    element: Element;
    previous: number; // Count before this one, so this is element number previous + 1
}

// "New PU elements for this Competition" — elements fitted during the weekend
export async function parseNewElements(data: Uint8Array): Promise<{ round?: number; changes: NewElement[] }> {
    const rows = await pdfRows(data)
    const changes: NewElement[] = []
    let current: Element | undefined
    for (const row of rows) {
        const line = row.join(' ')
        // "The following driver is using a new turbocharger (TC) for the remainder of the Competition:"
        if (/using (a )?new/i.test(line)) current = elementFromText(line)
        // 18 | Aston Martin Aramco Honda | Lance Stroll | 4
        else if (current && row.length >= 3 && /^\d{1,2}$/.test(row[0]) && /^\d+$/.test(row[row.length - 1])) {
            changes.push({ car: Number(row[0]), element: current, previous: Number(row[row.length - 1]) })
        }
    }
    return { round: roundFromEnclosure(joined(rows)), changes }
}

export interface Penalty {
    car: number;
    driver: string;
    elements: Array<{ element: Element; nth: number }>;
    decision: string; // "Drop of 40 grid positions for the next Race in which the driver participates."
    gridDrop?: number;
    pitLane: boolean;
}

// Stewards' infringement decision for PU elements over the limit
export async function parsePenalty(data: Uint8Array): Promise<Penalty | undefined> {
    const text = joined(await pdfRows(data))
    const who = text.match(/No \/ Driver\s+(\d{1,2})\s*-\s*([^\n]+)/)
    if (!who) return undefined
    // Only the "Fact" block lists the elements, one per line; the "Reason" prose repeats them loosely
    const fact = text.slice(text.indexOf('Fact'), text.search(/\n(Infringement|Decision)\b/))
    const elements = [...fact.matchAll(/(\d+)(?:st|nd|rd|th)\s+([^\n]+)/g)]
        .map(m => ({ nth: Number(m[1]), element: elementFromText(m[2]) }))
        .filter((e): e is { nth: number; element: Element } => e.element !== undefined)
    const decision = text.match(/Decision\s+([^\n]+)/)?.[1].trim() ?? ''
    const drop = decision.match(/(\d+)\s+grid (?:positions|places)/i)
    return {
        car: Number(who[1]),
        driver: who[2].trim(),
        elements,
        decision,
        gridDrop: drop ? Number(drop[1]) : undefined,
        pitLane: /pit ?lane/i.test(decision),
    }
}
