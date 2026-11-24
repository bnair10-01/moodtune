import { callClaude } from '../services/claudeApi.js'
import { parseJson } from '../utils/parseJson.js'
import { normalizePreferences } from '../utils/emotionHelpers.js'

const SYSTEM = `You are a music curator specialising in emotional resonance. Given a user's
emotional state, their listening preferences and a list of candidate tracks, select
the 10 that best fit.

Selection criteria (in priority order):
1. Preference match — if the user asked for a genre, language, era, artist,
   lyrics or instrumental, only pick tracks that clearly satisfy it. If they asked
   for recent music, prefer the newest tracks (the upload year is shown).
2. Mood accuracy — does the track genuinely suit this emotional state?
3. Variety — no more than 2 tracks from the same artist; mix tempos and styles
   within the requested preferences
4. Quality signal — prefer tracks with recognisable artist names over
   auto-generated or ambiguous titles

For each selected track provide a one-line reason (max 8 words) explaining
why it fits. Be specific, not generic.
Bad reason: "matches your current mood"
Good reason: "slow tempo mirrors your contemplative state"

Return ONLY valid JSON — no markdown, no explanation:
{
  "selected": [<indices into the candidates array, 0-based>],
  "reasons": [<one reason string per selected index, same order>]
}`

function year(publishedAt) {
  const y = publishedAt ? new Date(publishedAt).getFullYear() : null
  return y && !Number.isNaN(y) ? ` (${y})` : ''
}

export async function rankTracks(candidates, emotion) {
  try {
    const prefs = normalizePreferences(emotion.preferences)

    const candidateList = candidates
      .map((t, i) => `${i}. ${t.title} — ${t.channelTitle}${year(t.publishedAt)}`)
      .join('\n')

    const userContent = `Emotional state:
- quadrant: ${emotion.mood_quadrant}
- sub_emotion: ${emotion.sub_emotion}
- valence: ${emotion.valence}, arousal: ${emotion.arousal}, intensity: ${emotion.intensity}

Listening preferences:
${JSON.stringify(prefs)}

Candidates:
${candidateList}

Select the 10 best tracks and provide reasons.`

    const text = await callClaude({
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 800,
    })

    const { selected, reasons } = parseJson(text)
    if (!Array.isArray(selected) || selected.length === 0) throw new Error('Invalid ranker response')

    const used = new Set()
    const result = []
    selected.forEach((idx, i) => {
      if (!Number.isInteger(idx) || !candidates[idx] || used.has(idx)) return
      used.add(idx)
      result.push({ ...candidates[idx], reason: reasons?.[i] || 'Selected for your mood' })
    })

    if (result.length === 0) throw new Error('Ranker returned no valid indices')
    return result.slice(0, 10)
  } catch (err) {
    console.error('rankerAgent error:', err)
    return candidates.slice(0, 10).map((t) => ({
      ...t,
      reason: 'Selected for your mood',
    }))
  }
}
