import { openDB } from 'idb'

const DB_NAME = 'moodtune-db'
const STORE_NAME = 'playedTracks'

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'videoId' })
      }
    },
  })
}

export async function loadPlayedIds() {
  try {
    const db = await getDb()
    const all = await db.getAll(STORE_NAME)
    return new Set(all.map((r) => r.videoId))
  } catch (err) {
    console.error('Failed to load played IDs from IndexedDB:', err)
    return new Set()
  }
}

export async function savePlayedId(videoId) {
  try {
    const db = await getDb()
    await db.put(STORE_NAME, { videoId })
  } catch (err) {
    console.error('Failed to save played ID to IndexedDB:', err)
  }
}
