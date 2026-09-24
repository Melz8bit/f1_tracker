// Honour each site's robots.txt rules for all user agents ("User-agent: *")

const rules = new Map<string, string[]>()

async function disallowed(origin: string, fetchText: (url: string) => Promise<string>): Promise<string[]> {
    if (rules.has(origin)) return rules.get(origin)!
    let paths: string[] = []
    try {
        const txt = await fetchText(`${origin}/robots.txt`)
        let applies = false
        for (const raw of txt.split(/\r?\n/)) {
            const line = raw.split('#')[0].trim()
            const [key, ...rest] = line.split(':')
            const value = rest.join(':').trim()
            if (/^user-agent$/i.test(key)) applies = value === '*'
            else if (applies && /^disallow$/i.test(key) && value) paths.push(value)
        }
    } catch {
        paths = [] // No robots.txt = no restrictions
    }
    rules.set(origin, paths)
    return paths
}

export async function allowedByRobots(url: string, fetchText: (url: string) => Promise<string>): Promise<boolean> {
    const { origin, pathname } = new URL(url)
    const blocked = await disallowed(origin, fetchText)
    return !blocked.some(prefix => pathname.startsWith(prefix))
}
