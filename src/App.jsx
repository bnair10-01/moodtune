import { useEffect, useRef } from 'react'
import useAppStore from './store/appStore.js'
import { extractEmotion } from './agents/emotionAgent.js'
import { generateQueries } from './agents/queryAgent.js'
import { rankTracks } from './agents/rankerAgent.js'
import { searchTracks } from './services/youtubeApi.js'
import { shouldRegenerate, describePreferences } from './utils/emotionHelpers.js'
import TopBar from './components/TopBar.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import PlaylistPanel from './components/PlaylistPanel.jsx'

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function buildResponse(emotion, willRegen) {
  const { sub_emotion, arousal } = emotion
  const energyLine =
    arousal > 0.6
      ? "There's real energy in what you're describing."
      : 'Something quieter and more inward.'
  const prefParts = describePreferences(emotion.preferences)
  const regenLine = willRegen
    ? prefParts.length
      ? `Refreshing the playlist — ${prefParts.join(', ')}.`
      : 'Refreshing the playlist to match.'
    : 'The current playlist still feels right for this.'
  return `${capitalize(sub_emotion)} — I can feel that. ${energyLine} ${regenLine}`
}

export default function App() {
  const {
    messages,
    emotion: prevEmotion,
    playlist,
    playedIds,
    isGenerating,
    loadPlayedIds,
    addMessage,
    updateLastMessage,
    setEmotion,
    setPlaylist,
    setGenerating,
    markPlayed,
    setError,
    error,
  } = useAppStore()

  const lastEmotionRef = useRef(null)

  useEffect(() => {
    loadPlayedIds()
  }, [])

  useEffect(() => {
    lastEmotionRef.current = prevEmotion
  }, [prevEmotion])

  async function handleSend(userText) {
    if (isGenerating) return

    const prev = lastEmotionRef.current

    // 1. Add user message
    addMessage({ role: 'user', content: userText })
    setGenerating(true)
    setError(null)

    // 2. Show spinner placeholder as AI bubble
    addMessage({ role: 'spinner', content: '' })

    try {
      // 3. Build conversation history for Claude (exclude spinner)
      const historyForClaude = [...messages, { role: 'user', content: userText }]
        .filter((m) => m.role !== 'spinner')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }))

      // 4. Extract emotion
      const result = await extractEmotion(historyForClaude, prev)

      if (result.failed) {
        useAppStore.setState((state) => {
          const msgs = [...state.messages]
          const spinnerIdx = msgs.findLastIndex((m) => m.role === 'spinner')
          if (spinnerIdx !== -1) {
            msgs[spinnerIdx] = { role: 'assistant', content: result.errorMessage }
          }
          return { messages: msgs }
        })
        return
      }

      const newEmotion = result
      setEmotion(newEmotion)

      // 5. Determine if playlist should regenerate
      const willRegen = shouldRegenerate(prev, newEmotion)

      // 6. Build deterministic response and replace spinner
      const responseText = buildResponse(newEmotion, willRegen)
      updateLastMessage(responseText)
      // Flip role from spinner to assistant
      useAppStore.setState((state) => {
        const msgs = [...state.messages]
        const spinnerIdx = msgs.findLastIndex((m) => m.role === 'spinner')
        if (spinnerIdx !== -1) {
          msgs[spinnerIdx] = { role: 'assistant', content: responseText }
        }
        return { messages: msgs }
      })

      // 7. Regenerate playlist if needed
      if (willRegen) {
        const recentTitles = playlist.slice(0, 5).map((t) => t.title)
        const hour = new Date().getHours()
        setPlaylist([])

        const queries = await generateQueries(newEmotion, recentTitles, hour)

        let candidates
        try {
          candidates = await searchTracks(queries, playedIds, {
            recency: newEmotion.preferences.recency,
          })
        } catch (ytErr) {
          console.error('YouTube search failed:', ytErr)
          setError('youtube')
          setGenerating(false)
          return
        }

        const ranked = await rankTracks(candidates, newEmotion)
        setPlaylist(ranked)
        ranked.forEach((t) => markPlayed(t.videoId))
      }
    } catch (err) {
      console.error('Pipeline error:', err)
      // Replace spinner with error message
      useAppStore.setState((state) => {
        const msgs = [...state.messages]
        const spinnerIdx = msgs.findLastIndex((m) => m.role === 'spinner')
        if (spinnerIdx !== -1) {
          msgs[spinnerIdx] = {
            role: 'assistant',
            content: "Something went wrong. Please try again.",
          }
        }
        return { messages: msgs }
      })
    } finally {
      setGenerating(false)
    }
  }

  async function handleRetry() {
    if (!prevEmotion) return
    setError(null)
    setGenerating(true)
    try {
      const recentTitles = playlist.slice(0, 5).map((t) => t.title)
      const queries = await generateQueries(prevEmotion, recentTitles, new Date().getHours())
      const candidates = await searchTracks(queries, playedIds, {
        recency: prevEmotion.preferences?.recency ?? 'any',
      })
      const ranked = await rankTracks(candidates, prevEmotion)
      setPlaylist(ranked)
      ranked.forEach((t) => markPlayed(t.videoId))
    } catch (err) {
      console.error('Retry failed:', err)
      setError('youtube')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}
    >
      <TopBar />

      {/* Two-column layout */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{
          flexDirection: 'row',
        }}
      >
        {/* Chat panel — 38% */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{ width: '38%', minWidth: '280px' }}
        >
          <ChatPanel onSend={handleSend} />
        </div>

        {/* Playlist panel — 62% */}
        <div className="flex-1 overflow-hidden">
          <PlaylistPanel onRetry={handleRetry} />
        </div>
      </div>

      {/* Mobile styles via media query — injected inline */}
      <style>{`
        @media (max-width: 640px) {
          .layout-columns {
            flex-direction: column !important;
          }
          .layout-columns > * {
            width: 100% !important;
            min-height: 50vh;
          }
        }
      `}</style>
    </div>
  )
}
