import useAppStore from '../store/appStore.js'
import TrackCard from './TrackCard.jsx'
import GeneratingSpinner from './GeneratingSpinner.jsx'
import { describePreferences } from '../utils/emotionHelpers.js'

export default function PlaylistPanel({ onRetry }) {
  const playlist = useAppStore((s) => s.playlist)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const error = useAppStore((s) => s.error)
  const emotion = useAppStore((s) => s.emotion)

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '0.5px solid var(--border)' }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Your playlist
        </span>
        {emotion && (
          <span
            style={{
              fontSize: '11px',
              background: '#1e1a10',
              color: 'var(--accent-gold)',
              border: '0.5px solid #3a2e10',
              borderRadius: '20px',
              padding: '2px 8px',
            }}
          >
            Generated for your mood
          </span>
        )}
      </div>

      {/* Active preferences */}
      {describePreferences(emotion?.preferences).length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 px-5 py-2 flex-shrink-0"
          style={{ borderBottom: '0.5px solid var(--border)' }}
        >
          {describePreferences(emotion.preferences).map((p) => (
            <span
              key={p}
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--border)',
                borderRadius: '20px',
                padding: '2px 8px',
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
        {isGenerating && playlist.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <GeneratingSpinner />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Finding tracks for your mood...
            </p>
          </div>
        )}

        {error && !isGenerating && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Couldn't reach YouTube right now. Try again.
            </p>
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--border)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!error && !isGenerating && playlist.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Your playlist will appear here once you share how you're feeling.
            </p>
          </div>
        )}

        {playlist.map((track) => (
          <TrackCard key={track.videoId} track={track} />
        ))}

        {isGenerating && playlist.length > 0 && (
          <div className="flex justify-center py-3">
            <GeneratingSpinner />
          </div>
        )}
      </div>
    </div>
  )
}
