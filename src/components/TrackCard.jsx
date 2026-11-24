import { useState } from 'react'
import useAppStore from '../store/appStore.js'
import { moodColor } from '../utils/emotionHelpers.js'

export default function TrackCard({ track }) {
  const activeVideoId = useAppStore((s) => s.activeVideoId)
  const setActiveVideo = useAppStore((s) => s.setActiveVideo)
  const emotion = useAppStore((s) => s.emotion)
  const [imgError, setImgError] = useState(false)

  const isActive = activeVideoId === track.videoId
  const dotColor = moodColor(emotion?.mood_quadrant)

  return (
    <div
      className="track-card flex items-center gap-3 cursor-pointer"
      onClick={() => setActiveVideo(isActive ? null : track.videoId)}
      style={{
        background: 'var(--bg-surface)',
        border: `0.5px solid ${isActive ? 'var(--accent-gold)' : 'var(--border)'}`,
        borderRadius: '10px',
        padding: '10px 12px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = '#3a3a60'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Thumbnail */}
      {!imgError && track.thumbnail ? (
        <img
          src={track.thumbnail}
          alt={track.title}
          width={44}
          height={44}
          className="flex-shrink-0 object-cover"
          style={{ borderRadius: '6px', width: '44px', height: '44px' }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="thumb-fallback flex-shrink-0"
          style={{
            width: '44px',
            height: '44px',
            background: 'var(--bg-hover)',
            border: '0.5px solid var(--border)',
          }}
        >
          ♫
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p
          className="truncate-text"
          style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}
        >
          {track.title}
        </p>
        <p
          className="truncate-text"
          style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
        >
          {track.channelTitle}
        </p>
        {track.reason && (
          <span
            className="truncate-text inline-block self-start"
            style={{
              fontSize: '11px',
              background: '#1e1a10',
              color: 'var(--accent-gold)',
              border: '0.5px solid #3a2e10',
              borderRadius: '20px',
              padding: '2px 8px',
              maxWidth: '100%',
            }}
          >
            {track.reason}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <a
          href={`https://youtube.com/watch?v=${track.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: '11px',
            color: 'var(--accent-red)',
            background: '#1a0f0f',
            border: '0.5px solid #3a1515',
            borderRadius: '6px',
            padding: '3px 8px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ▶ YT
        </a>
        {isActive && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: dotColor }}
          />
        )}
      </div>
    </div>
  )
}
