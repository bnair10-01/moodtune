# MoodTune

**Tell it how your day went. It builds a playlist that fits, and it respects what you ask for.**

MoodTune is a chat app that turns free-text feelings ("my meeting got cancelled again, nothing's going right... play me instrumental classical") into a 10-track YouTube playlist. Three cooperating LLM agents handle emotion analysis, search-query generation and curation. Deterministic code handles validation, deduplication, fallbacks and the "should we regenerate?" decision.

<!-- Add a screenshot or GIF here: docs/demo.gif -->

---

## How it works

```
 user message
      │
      ▼
┌───────────────┐  valence/arousal, quadrant, sub-emotion,
│ Emotion agent │  persistent listening preferences (genre, language, era,
└──────┬────────┘  vocals, recency, artists)
       ▼
┌───────────────┐  shouldRegenerate(prev, next): pure function, no LLM
│ Regen gate    │  drift > 0.2 on valence/arousal, quadrant or sub-emotion change,
└──────┬────────┘  or changed preferences → rebuild. Otherwise keep the playlist.
       ▼
┌───────────────┐  5 diverse YouTube queries that honour preferences
│ Query agent   │  (+ time of day, current year, recently played artists)
└──────┬────────┘
       ▼
┌───────────────┐  5 parallel searches (Promise.allSettled), dedupe by videoId,
│ YouTube search│  drop already-played tracks, pad so the pool never runs dry
└──────┬────────┘
       ▼
┌───────────────┐  picks 10, ≤2 per artist, one specific reason per track;
│ Ranker agent  │  indices are validated against the candidate list
└───────────────┘
```

### Design decisions

- **Separate agents with narrow prompts.** Each agent has one job and a strict JSON contract, so each can be tested and swapped on its own.
- **Preferences are state.** "Give me classical" persists across turns until the user changes or cancels it, so "that's too sad, something upbeat" keeps the genre. The emotion agent receives the previous state and returns the merged one.
- **LLM output is untrusted input.** `parseJson` strips code fences and falls back to bracket extraction. `normalizePreferences` coerces every field to an enum or type. The ranker discards invalid, duplicate or out-of-range indices.
- **Graceful degradation at every stage.** Emotion failure returns a friendly, cause-specific error (bad key, no credits, rate limit) and keeps the prior state. Query failure falls back to templated queries built from the mood and preferences. Ranker failure falls back to the top 10 candidates. YouTube failure shows a retry UI.
- **The "regenerate or not" decision is deterministic.** It's cheap, explainable and unit-checkable, and it saves a full pipeline run when the mood hasn't meaningfully moved.
- **Cross-session novelty.** Played track IDs are stored in IndexedDB, so repeat sessions don't serve the same songs.

---

## Tech stack

| Layer | Tech | Why |
|---|---|---|
| UI | React 18, Tailwind CSS 3 | Component-based chat and playlist panels |
| Build | Vite 5 | Instant dev server, small production bundle |
| State | Zustand 4 | Minimal store without provider boilerplate |
| Persistence | IndexedDB via `idb` | Played-track history that survives reloads |
| LLM | Anthropic Messages API (Claude Sonnet) | Three prompts: emotion extraction, query generation, curation |
| Music data | YouTube Data API v3 (`search.list`, category 10 = Music) | Free, no per-user OAuth |

No backend. The app is a static SPA that calls both APIs directly from the browser (see [Limitations](#limitations)).

---

## Metrics

Measured with [`scripts/benchmark.mjs`](scripts/benchmark.mjs) on 2026-11-24. It loads the real `src/` modules through Vite's SSR loader, so it measures the shipped code, not a copy. Raw output is in [`scripts/benchmark-results.json`](scripts/benchmark-results.json).

| Metric | Result |
|---|---|
| **Mood-quadrant accuracy** (12 hand-labelled utterances, 3 per quadrant) | **12 / 12 (100%)** |
| **Preference extraction + constraint adherence** (5 end-to-end scenarios: genre, instrumental, language, era, new-releases + lyrics; 39 automated checks) | **38 / 39 (97%)** |
| **Regeneration-gate logic** (6 deterministic cases, offline) | **6 / 6** |
| Ranker returned exactly 10 tracks | 5 / 5 runs |
| Ranker fell back to un-ranked results | 0 / 5 runs |
| Claude API errors | 0 / 27 calls |
| Candidate pool size per run | 15 to 30 tracks |
| **Production bundle** | **175 KB JS (57.5 KB gzip) + 7.8 KB CSS (2.5 KB gzip)**, built in under 1 s |
| Source size | about 1,300 lines, 18 modules |
| **Cost per playlist** | 3 Claude calls + 5 YouTube searches (500 of 10,000 daily quota units, about 20 playlists/day on the free tier) |

**Latency by stage** (median over 5 end-to-end runs): emotion ≈ 2.1 s, query generation ≈ 4.1 s, YouTube (5 parallel searches) ≈ 0.5 s, ranking ≈ 3.4 s. **Total ≈ 10.4 s** (range 9.3 to 11.9 s).

What the automated checks verify:

- Instrumental requests put "instrumental" in all 5 queries.
- A named genre appears in all 5 queries.
- A named era appears in all 5 queries.
- A named language appears in at least 4 of 5 queries.
- New-releases requests carry the current year in at least 3 queries.
- Lyrics requests avoid "instrumental", "ambient" and "beats".
- No query contains "playlist".
- The ranker returns no duplicate tracks.
- The ranker picks at most 2 tracks per artist.
- Every track gets a specific, non-fallback reason.

### Caveats on these numbers

- **The model calls ran through the Claude Code CLI, not the raw API.** This was done with `BENCH_VIA_CLI=1` so no API key was needed. Accuracy and adherence results are valid, but **Claude latency includes about 2 s of CLI start-up per call**. Treat the stage latencies as upper bounds. Token totals (about 53k in / 5k out over 27 calls) are also inflated by the CLI's own system prompt. Running `node scripts/benchmark.mjs` with an API key gives direct-API numbers.
- **The sample is small.** 12 mood utterances and 5 scenarios show the pipeline behaves well. They don't establish a statistically robust accuracy figure. The mood labels are unambiguous by design, so real, mixed-emotion messages would score lower.
- **The one failed check** was the ranker's "max 2 per artist" rule in the Hindi scenario. The check uses YouTube's `channelTitle` as the artist, and Hindi music is dominated by label channels, so one channel can legitimately host several artists. I haven't verified that this is the cause.
- **There is no measure of "does this playlist feel right".** That's subjective. The benchmark only checks that stated constraints are honoured.

Reproduce:

```bash
cp .env.example .env        # add your keys
node scripts/benchmark.mjs  # a few minutes; ~2,500 YouTube quota units, 27 Claude calls
```

---

## Getting started

```bash
git clone <this repo> && cd moodtune
npm install
cp .env.example .env
```

Fill in `.env`:

```
VITE_ANTHROPIC_KEY=sk-ant-...      # console.anthropic.com (needs credits)
VITE_YT_KEY=AIza...                # Google Cloud → enable "YouTube Data API v3"
```

```bash
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

Try: *"Just got promoted, I feel unstoppable"*, then *"actually give me 90s hip hop"*, then *"ugh, long day, something calmer"*.

---

## Project structure

```
src/
├── agents/        emotionAgent · queryAgent · rankerAgent   (prompt + validation + fallback)
├── services/      claudeApi (fetch + error mapping) · youtubeApi (parallel search, dedupe)
├── utils/         emotionHelpers (preferences, regen gate) · parseJson · history (IndexedDB)
├── store/         appStore (Zustand)
├── components/    ChatPanel · PlaylistPanel · TrackCard · EmotionBadge · TopBar …
└── App.jsx        orchestrates the pipeline
scripts/
└── benchmark.mjs  reproducible evaluation harness
```

---

## Limitations

**Security**
- **API keys are exposed to the browser.** `VITE_*` variables are inlined into the JS bundle, and the Anthropic call uses `anthropic-dangerous-direct-browser-access`. That is fine for local use and demos. **Don't deploy this publicly with your own keys.** The fix is a thin serverless proxy (Cloudflare Worker or Vercel function) that holds the keys and adds rate limiting. A bring-your-own-key input is a lighter alternative.

**Recommendation quality**
- **Mood matching is inferred from text, not audio.** There are no tempo, key or energy features. The ranker only sees title, channel and upload year, so it matches on the reputation of artists and tracks it already knows. Obscure tracks are effectively judged by their titles.
- **YouTube search is noisy.** Results can include covers, lyric videos, live versions or compilations. Category filtering (`videoCategoryId=10`) helps but doesn't eliminate this. The "recent" and "new releases" filters use upload date, which is not release date.
- **Moods are a coarse four-quadrant model** (valence/arousal) plus one sub-emotion word. Mixed or sarcastic messages can be misread.
- **The model chooses between mood and preference.** When they conflict, preferences win by design. For example, someone who is sad but asks for upbeat pop gets upbeat pop.

**Engineering**
- **Latency of about 10 s per playlist.** The pipeline is three sequential LLM calls. Streaming, a smaller model for extraction, or merging the query and ranking prompts would cut this.
- **Quota ceiling.** `search.list` costs 100 units, so the free tier allows about 20 playlists/day per key.
- **No automated test suite.** The benchmark script covers the end-to-end behaviour. Unit tests for `parseJson`, `normalizePreferences` and `shouldRegenerate` would be the next step.
- **Playback is "open on YouTube".** There's no embedded player, and no Spotify or Apple Music export.
- **History is per browser.** Played IDs live in IndexedDB, grow without bound and don't sync across devices.
- **LLM output is non-deterministic.** The same input can yield a different playlist. The benchmark reflects a single run per scenario.
- **Unused dependency.** `axios` is listed in `package.json` but not used, and can be removed.

## Roadmap

- Serverless proxy and rate limiting
- Unit tests plus a larger labelled mood set (including ambiguous and mixed-emotion cases)
- Embedded YouTube player with auto-advance
- Streaming responses
- Audio-feature grounding (for example MusicBrainz or AcousticBrainz) to complement text-only reasoning
