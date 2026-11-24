import useAppStore from '../store/appStore.js'
import { moodColor, quadrantLabel } from '../utils/emotionHelpers.js'
import GeneratingSpinner from './GeneratingSpinner.jsx'

export default function EmotionBadge() {
  const emotion = useAppStore((s) => s.emotion)
  const isGenerating = useAppStore((s) => s.isGenerating)

  if (!emotion && !isGenerating) return null

  if (isGenerating && !emotion) {
    return (
      <div
        className="emotion-badge flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
        }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: 'var(--text-muted)' }}
        />
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          Analysing...
        </span>
      </div>
    )
  }

  const color = moodColor(emotion?.mood_quadrant)
  const label = emotion ? quadrantLabel(emotion) : 'Analysing...'
  const intensity = emotion?.intensity ?? 0

  return (
    <div
      className="emotion-badge flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: isGenerating ? 'var(--text-muted)' : color,
          boxShadow: isGenerating ? 'none' : `0 0 6px ${color}88`,
        }}
      />
      <span
        style={{
          color: 'var(--text-primary)',
          fontSize: '12px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {isGenerating ? 'Analysing...' : label}
      </span>
      {emotion && !isGenerating && (
        <div
          className="rounded-full overflow-hidden flex-shrink-0"
          style={{ width: '48px', height: '3px', background: 'var(--border)' }}
        >
          <div
            className="intensity-bar h-full rounded-full"
            style={{
              width: `${Math.round(intensity * 100)}%`,
              background: 'var(--accent-gold)',
            }}
          />
        </div>
      )}
    </div>
  )
}
