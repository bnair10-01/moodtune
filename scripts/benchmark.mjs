// Reproducible benchmark for the MoodTune agent pipeline.
// Usage: node scripts/benchmark.mjs   (needs VITE_ANTHROPIC_KEY + VITE_YT_KEY in .env)
// Loads the real src/ modules through Vite's SSR loader, so what is measured is what ships.
import { createServer } from 'vite'
import { writeFileSync } from 'node:fs'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const load = (p) => vite.ssrLoadModule(p)
const { extractEmotion } = await load('/src/agents/emotionAgent.js')
const { generateQueries } = await load('/src/agents/queryAgent.js')
const { rankTracks } = await load('/src/agents/rankerAgent.js')
const { searchTracks } = await load('/src/services/youtubeApi.js')
const { shouldRegenerate } = await load('/src/utils/emotionHelpers.js')

// ---- instrument fetch: capture Claude token usage + per-call latency, count YouTube calls
const stats = { claude: [], yt: 0 }
const realFetch0 = globalThis.fetch
// BENCH_VIA_CLI=1: serve api.anthropic.com calls through the local `claude` CLI (subscription login,
// no API key). Accuracy/adherence metrics stay valid; Claude latency then includes CLI start-up.
const viaCli = process.env.BENCH_VIA_CLI === '1'
const realFetch = viaCli
  ? async (url, opts) => {
      if (!String(url).includes('anthropic.com')) return realFetch0(url, opts)
      const { execFileSync } = await import('node:child_process')
      const body = JSON.parse(opts.body)
      const prompt = body.messages.map((m) => m.content).join('\n\n')
      const out = execFileSync('claude', ['-p', prompt, '--system-prompt', body.system, '--output-format', 'json',
        '--model', process.env.BENCH_MODEL || 'sonnet', '--tools', '', '--no-session-persistence',
        '--disable-slash-commands', '--setting-sources', ''], { cwd: process.env.BENCH_CWD || '/tmp', encoding: 'utf8', maxBuffer: 1 << 24 })
      const j = JSON.parse(out)
      return new Response(JSON.stringify({ content: [{ type: 'text', text: j.result }],
        usage: { input_tokens: (j.usage?.input_tokens ?? 0) + (j.usage?.cache_creation_input_tokens ?? 0) + (j.usage?.cache_read_input_tokens ?? 0), output_tokens: j.usage?.output_tokens ?? 0 } }), { status: 200 })
    }
  : realFetch0
globalThis.fetch = async (url, opts) => {
  const t = performance.now()
  const res = await realFetch(url, opts)
  const u = String(url)
  if (u.includes('anthropic.com')) {
    const j = await res.clone().json().catch(() => null)
    stats.claude.push({ ms: performance.now() - t, in: j?.usage?.input_tokens ?? 0, out: j?.usage?.output_tokens ?? 0, ok: res.ok })
  } else if (u.includes('googleapis.com/youtube')) stats.yt++
  return res
}

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] }
const med = (a) => pct(a, 50)
const time = async (fn) => { const t = performance.now(); const r = await fn(); return [r, performance.now() - t] }

// ---- 1. Mood classification accuracy (labelled utterances, quadrant ground truth) ----
const LABELLED = [
  ['I just got the job offer, I can barely sit still!', 'happy'],
  ['Best weekend ever, we hiked and everything went perfectly', 'happy'],
  ['My team won the finals tonight, I am buzzing', 'happy'],
  ['My dog passed away this morning and the house feels empty', 'sad'],
  ['I feel so lonely lately, nobody texts me anymore', 'sad'],
  ['Failed my exam again. I just want to disappear for a while', 'sad'],
  ['My landlord lied to us AGAIN and I am absolutely furious', 'angry'],
  ['I am so sick of being talked over in every single meeting', 'angry'],
  ['Someone cut me off in traffic and I want to scream', 'angry'],
  ['Sunday evening, tea in hand, nothing to do. Pretty content', 'relaxed'],
  ['Just finished yoga, feeling calm and loose', 'relaxed'],
  ['Rainy afternoon, reading by the window, perfectly peaceful', 'relaxed'],
]
const mood = []
for (const [text, truth] of LABELLED) {
  const [e, ms] = await time(() => extractEmotion([{ role: 'user', content: text }], null))
  mood.push({ text, truth, got: e.mood_quadrant, ok: !e.failed && e.mood_quadrant === truth, ms, failed: !!e.failed })
}

// ---- 2. Full pipeline on preference-heavy scenarios ----
const year = String(new Date().getFullYear())
const SCENARIOS = [
  { name: 'baseline-happy', text: 'I just got promoted, I feel unstoppable!', expect: {} },
  { name: 'genre+instrumental', text: 'Rough day, I am drained. Give me instrumental classical to unwind', expect: { genre: 'classical', vocals: 'instrumental' } },
  { name: 'language', text: 'Nervous before my interview tomorrow. Play me some Hindi songs', expect: { language: 'hindi' } },
  { name: 'era+genre', text: 'Pumped for the gym, I want 90s hip hop', expect: { genre: 'hip hop', era: '90s' } },
  { name: 'new-releases+lyrics', text: 'Lonely rainy night. Newest releases only, with lyrics please', expect: { recency: 'new_releases', vocals: 'with_lyrics' } },
]
const runs = []
for (const sc of SCENARIOS) {
  const r = { name: sc.name, checks: {} }
  let e
  ;[e, r.emotionMs] = await time(() => extractEmotion([{ role: 'user', content: sc.text }], null))
  const p = e.preferences
  const x = sc.expect
  if (x.genre) r.checks.prefGenre = p.genres.some((g) => g.includes(x.genre))
  if (x.vocals) r.checks.prefVocals = p.vocals === x.vocals
  if (x.language) r.checks.prefLanguage = (p.language || '').toLowerCase() === x.language
  if (x.era) r.checks.prefEra = (p.era || '').toLowerCase().replace(/'/g, '') === x.era
  if (x.recency) r.checks.prefRecency = p.recency === x.recency

  let queries
  ;[queries, r.queryMs] = await time(() => generateQueries(e, [], 20))
  r.queries = queries
  r.checks.fiveQueries = queries.length === 5
  const all = queries.join(' | ').toLowerCase()
  if (x.vocals === 'instrumental') r.checks.queriesAllInstrumental = queries.every((q) => /instrumental/i.test(q))
  if (x.genre) r.checks.queriesAllInGenre = queries.every((q) => q.toLowerCase().includes(x.genre))
  if (x.era) r.checks.queriesAllInEra = queries.every((q) => q.toLowerCase().includes(x.era.replace('s', '')))
  if (x.language) r.checks.queries4of5Language = queries.filter((q) => q.toLowerCase().includes(x.language)).length >= 4
  if (x.recency === 'new_releases') r.checks.queriesCarryYear = queries.filter((q) => q.includes(year)).length >= 3
  if (x.vocals === 'with_lyrics') r.checks.queriesNoInstrumental = !/instrumental|ambient|beats/.test(all)
  r.checks.noPlaylistWord = !/playlist/.test(all)

  let cands
  ;[cands, r.searchMs] = await time(() => searchTracks(queries, new Set(), { recency: p.recency }))
  r.candidates = cands.length
  let ranked
  ;[ranked, r.rankMs] = await time(() => rankTracks(cands, e))
  r.ranked = ranked.length
  const byArtist = {}
  ranked.forEach((t) => (byArtist[t.channelTitle] = (byArtist[t.channelTitle] || 0) + 1))
  r.checks.rankerMax2PerArtist = Math.max(...Object.values(byArtist)) <= 2
  r.checks.rankerNoDupes = new Set(ranked.map((t) => t.videoId)).size === ranked.length
  r.checks.rankerReasonsSpecific = ranked.every((t) => t.reason && t.reason !== 'Selected for your mood')
  r.rankerFellBack = ranked.every((t) => t.reason === 'Selected for your mood')
  r.totalMs = r.emotionMs + r.queryMs + r.searchMs + r.rankMs
  runs.push(r)
}

// ---- 3. Regeneration gate (deterministic, no network) ----
const base = { mood_quadrant: 'sad', valence: 0.2, arousal: 0.3, sub_emotion: 'lonely', preferences: {} }
const gate = [
  ['identical state -> keep playlist', base, base, false],
  ['small valence drift (0.1) -> keep', base, { ...base, valence: 0.3 }, false],
  ['valence jump (0.3) -> regenerate', base, { ...base, valence: 0.5 }, true],
  ['quadrant change -> regenerate', base, { ...base, mood_quadrant: 'angry' }, true],
  ['new genre preference -> regenerate', base, { ...base, preferences: { genres: ['jazz'] } }, true],
  ['first message -> regenerate', null, base, true],
].map(([name, a, b, want]) => ({ name, ok: shouldRegenerate(a, b) === want }))

await vite.close()

// ---- report ----
const sum = (a) => a.reduce((x, y) => x + y, 0)
const checkVals = runs.flatMap((r) => Object.values(r.checks))
const calls = stats.claude
const report = {
  date: new Date().toISOString().slice(0, 10),
  model: viaCli ? (process.env.BENCH_MODEL || 'sonnet') : 'claude-sonnet-4-6',
  moodAccuracy: { correct: mood.filter((m) => m.ok).length, total: mood.length, misses: mood.filter((m) => !m.ok).map((m) => [m.text, m.truth, m.got]) },
  emotionCallMs: { p50: med(mood.map((m) => m.ms)), p95: pct(mood.map((m) => m.ms), 95) },
  pipeline: {
    runs: runs.length,
    stageMedianMs: { emotion: med(runs.map((r) => r.emotionMs)), queries: med(runs.map((r) => r.queryMs)), youtube: med(runs.map((r) => r.searchMs)), rank: med(runs.map((r) => r.rankMs)), total: med(runs.map((r) => r.totalMs)) },
    totalMs: runs.map((r) => Math.round(r.totalMs)),
    candidatePool: runs.map((r) => r.candidates),
    rankedCount: runs.map((r) => r.ranked),
    rankerFallbacks: runs.filter((r) => r.rankerFellBack).length,
    checksPassed: checkVals.filter(Boolean).length,
    checksTotal: checkVals.length,
    failedChecks: runs.flatMap((r) => Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => `${r.name}:${k}`)),
  },
  regenGate: { passed: gate.filter((g) => g.ok).length, total: gate.length },
  usage: {
    claudeCalls: calls.length, claudeErrors: calls.filter((c) => !c.ok).length,
    inputTokens: sum(calls.map((c) => c.in)), outputTokens: sum(calls.map((c) => c.out)),
    youtubeSearchCalls: stats.yt, youtubeQuotaUnits: stats.yt * 100,
    claudeCallsPerPlaylist: 7, // 1 emotion + 1 query + 1 rank = 3 Claude calls; kept for clarity below
  },
  perPlaylist: { claudeCalls: 3, youtubeSearches: 5, youtubeQuotaUnits: 500 },
  runs: runs.map((r) => ({ name: r.name, queries: r.queries, checks: r.checks })),
}
delete report.usage.claudeCallsPerPlaylist
writeFileSync('scripts/benchmark-results.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
