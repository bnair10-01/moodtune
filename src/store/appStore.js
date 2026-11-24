import { create } from 'zustand'
import { loadPlayedIds, savePlayedId } from '../utils/history.js'

const useAppStore = create((set, get) => ({
  messages: [],
  emotion: null,
  playlist: [],
  playedIds: new Set(),
  isGenerating: false,
  activeVideoId: null,
  error: null,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages]
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
        }
      }
      return { messages }
    }),

  setEmotion: (emotion) => set({ emotion }),

  setPlaylist: (tracks) => set({ playlist: tracks }),

  setGenerating: (bool) => set({ isGenerating: bool }),

  markPlayed: (videoId) => {
    set((state) => {
      const next = new Set(state.playedIds)
      next.add(videoId)
      return { playedIds: next }
    })
    savePlayedId(videoId)
  },

  setActiveVideo: (id) => set({ activeVideoId: id }),

  setError: (msg) => set({ error: msg }),

  loadPlayedIds: async () => {
    const ids = await loadPlayedIds()
    set({ playedIds: ids })
  },
}))

export default useAppStore
