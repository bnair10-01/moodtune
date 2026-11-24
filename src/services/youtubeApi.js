const YT_BASE = 'https://www.googleapis.com/youtube/v3/search'

const RECENCY_DAYS = { recent: 365, new_releases: 90 }
const MIN_POOL = 20

async function searchQuery(query, recency) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults: '6',
    q: query,
    key: import.meta.env.VITE_YT_KEY,
  })

  const days = RECENCY_DAYS[recency]
  if (days) {
    params.set('publishedAfter', new Date(Date.now() - days * 86400000).toISOString())
    params.set('order', 'viewCount')
  }

  const response = await fetch(`${YT_BASE}?${params}`)
  if (!response.ok) throw new Error(`YouTube API error: ${response.status}`)
  const data = await response.json()

  return (data.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || '',
    publishedAt: item.snippet.publishedAt || '',
  }))
}

export async function searchTracks(queries, playedIds = new Set(), { recency = 'any' } = {}) {
  const results = await Promise.allSettled(queries.map((q) => searchQuery(q, recency)))

  const all = []
  let failed = 0
  for (const result of results) {
    if (result.status === 'fulfilled') {
      all.push(...result.value)
    } else {
      failed += 1
      console.error('YouTube query failed:', result.reason)
    }
  }

  if (all.length === 0) {
    if (failed === 0 && recency !== 'any') {
      return searchTracks(queries, playedIds, { recency: 'any' })
    }
    throw new Error('All YouTube queries failed')
  }

  // Deduplicate by videoId (keep first occurrence)
  const seen = new Set()
  const deduped = []
  for (const track of all) {
    if (!seen.has(track.videoId)) {
      seen.add(track.videoId)
      deduped.push(track)
    }
  }

  // Prefer tracks not heard before, but pad with heard ones so the pool never runs dry
  const fresh = deduped.filter((t) => !playedIds.has(t.videoId))
  if (fresh.length >= MIN_POOL) return fresh
  const heard = deduped.filter((t) => playedIds.has(t.videoId))
  return [...fresh, ...heard].slice(0, Math.max(MIN_POOL, fresh.length))
}
