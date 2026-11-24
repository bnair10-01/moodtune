export const DEFAULT_PREFERENCES = {
  genres: [],
  recency: 'any',
  vocals: 'any',
  language: null,
  era: null,
  artists: [],
  notes: '',
}

export function normalizePreferences(p) {
  const src = p && typeof p === 'object' ? p : {}
  const list = (v) =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().toLowerCase())
      : []
  const str = (v) =>
    typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim() : null

  return {
    genres: list(src.genres),
    recency: ['recent', 'new_releases'].includes(src.recency) ? src.recency : 'any',
    vocals: ['with_lyrics', 'instrumental'].includes(src.vocals) ? src.vocals : 'any',
    language: str(src.language),
    era: str(src.era),
    artists: list(src.artists),
    notes: typeof src.notes === 'string' ? src.notes.trim() : '',
  }
}

function preferencesKey(p) {
  const n = normalizePreferences(p)
  return JSON.stringify([
    [...n.genres].sort(),
    [...n.artists].sort(),
    n.recency,
    n.vocals,
    (n.language || '').toLowerCase(),
    (n.era || '').toLowerCase(),
  ])
}

export function describePreferences(p) {
  const n = normalizePreferences(p)
  const parts = []
  if (n.genres.length) parts.push(n.genres.join(' / '))
  if (n.recency === 'new_releases') parts.push('new releases')
  else if (n.recency === 'recent') parts.push('recent music')
  if (n.vocals === 'with_lyrics') parts.push('with lyrics')
  else if (n.vocals === 'instrumental') parts.push('instrumental')
  if (n.language) parts.push(n.language)
  if (n.era) parts.push(n.era)
  if (n.artists.length) parts.push(n.artists.join(', '))
  return parts
}

export function shouldRegenerate(prev, next) {
  if (!prev) return true
  if (prev.mood_quadrant !== next.mood_quadrant) return true
  if (Math.abs(next.valence - prev.valence) > 0.2) return true
  if (Math.abs(next.arousal - prev.arousal) > 0.2) return true
  if ((prev.sub_emotion || '').toLowerCase() !== (next.sub_emotion || '').toLowerCase()) return true
  if (preferencesKey(prev.preferences) !== preferencesKey(next.preferences)) return true
  return false
}

export function moodColor(quadrant) {
  const map = {
    happy: '#1D9E75',
    sad: '#7F77DD',
    angry: '#D85A30',
    relaxed: '#EF9F27',
  }
  return map[quadrant] ?? '#888780'
}

export function quadrantLabel(emotion) {
  const sub = emotion.sub_emotion
    ? emotion.sub_emotion.charAt(0).toUpperCase() + emotion.sub_emotion.slice(1)
    : ''
  const labels = (emotion.labels || []).slice(0, 2).join(', ')
  return labels ? `${sub} · ${labels}` : sub
}
