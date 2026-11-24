import { callClaude } from '../services/claudeApi.js'
import { parseJson } from '../utils/parseJson.js'
import { normalizePreferences } from '../utils/emotionHelpers.js'

const SYSTEM = `You are a music search expert. Given a user's emotional state and their explicit
listening preferences, generate exactly 5 YouTube music search query strings that
would surface songs fitting both the mood and the preferences.

Rules:
- If the user named genres, ALL 5 queries must stay inside those genres. Vary
  subgenre, artist, era and tempo instead. If no genre was named, each query must
  target a DIFFERENT genre.
- recency "recent": favour current artists and put the current year in at least 3
  queries. recency "new_releases": target the very latest releases, use words like
  "new" and "latest" plus the current year in every query.
- vocals "with_lyrics": target songs with singing and lyrics; never use words like
  instrumental, ambient, or beats. vocals "instrumental": add "instrumental" to
  every query and avoid vocal-focused terms.
- If a language is given, target that language's music in at least 4 queries.
  Otherwise include at least one non-English query.
- If an era is given, keep every query in that era. Otherwise, when recency is
  "any", spread the queries across decades from the 60s to the 2020s.
- If artists are named, make 2 queries by or in the style of those artists.
- Mix mainstream and underground artists. Vary tempo.
- Queries must be specific enough to find real tracks, not just genre labels.
  Good: "melancholic indie folk elliott smith sufjan stevens style acoustic"
  Bad: "sad songs"
- Avoid artists that appear in the recently played list.
- Do NOT include the word "playlist" in any query.

Return ONLY a valid JSON array of exactly 5 strings. No markdown, no explanation.`

const FALLBACKS = {
  happy: ['upbeat indie pop feel good', 'funk soul happy 70s', 'dance electronic euphoric'],
  sad: ['sad indie folk acoustic', 'melancholic piano jazz', 'emotional alternative rock'],
  angry: ['intense rock aggressive', 'hip hop hard beats', 'metal high energy'],
  relaxed: ['lo-fi chill beats study', 'ambient acoustic guitar', 'soft jazz calm evening'],
}

function fallbackQueries(emotion, prefs) {
  const year = new Date().getFullYear()
  const base = prefs.genres.length
    ? prefs.genres.slice(0, 3).map((g) => `${g} ${emotion.sub_emotion || emotion.mood_quadrant}`)
    : FALLBACKS[emotion.mood_quadrant] ?? FALLBACKS.relaxed

  return base.map((q) => {
    const extras = []
    if (prefs.artists.length) extras.push(prefs.artists.join(' '))
    if (prefs.language) extras.push(prefs.language)
    if (prefs.era) extras.push(prefs.era)
    if (prefs.recency === 'new_releases') extras.push(`new ${year}`)
    else if (prefs.recency === 'recent') extras.push(String(year))
    if (prefs.vocals === 'with_lyrics') extras.push('lyrics')
    if (prefs.vocals === 'instrumental') extras.push('instrumental')
    return [q, ...extras].join(' ')
  })
}

export async function generateQueries(
  emotion,
  recentTitles = [],
  hour = new Date().getHours()
) {
  const prefs = normalizePreferences(emotion.preferences)

  try {
    const recentStr =
      recentTitles.length > 0
        ? `Recently played: ${recentTitles.join(', ')}`
        : 'No recent tracks.'

    const userContent = `Emotional state:
- mood_quadrant: ${emotion.mood_quadrant}
- sub_emotion: ${emotion.sub_emotion}
- valence: ${emotion.valence} (0=very negative, 1=very positive)
- arousal: ${emotion.arousal} (0=very calm, 1=very intense)
- intensity: ${emotion.intensity}
- Hour of day: ${hour} (0=midnight, 12=noon)
- Current year: ${new Date().getFullYear()}
${recentStr}

Listening preferences (honour these strictly):
${JSON.stringify(prefs, null, 2)}

Generate 5 YouTube music search queries.`

    const text = await callClaude({
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 400,
    })

    const parsed = parseJson(text)
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid queries')
    return parsed.filter((q) => typeof q === 'string' && q.trim()).slice(0, 5)
  } catch (err) {
    console.error('queryAgent error:', err)
    return fallbackQueries(emotion, prefs)
  }
}
