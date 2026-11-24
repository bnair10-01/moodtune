import useAppStore from '../store/appStore.js'
import EmotionBadge from './EmotionBadge.jsx'

export default function TopBar() {
  const playlist = useAppStore((s) => s.playlist)

  return (
    <header
      className="flex items-center justify-between px-5 flex-shrink-0"
      style={{
        height: '52px',
        background: 'var(--bg-base)',
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      {/* Logo */}
      <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
        mood<span style={{ color: 'var(--accent-gold)' }}>tune</span>
      </span>

      {/* Emotion badge */}
      <EmotionBadge />

      {/* Track count */}
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>
        {playlist.length > 0 ? `${playlist.length} tracks` : ''}
      </span>
    </header>
  )
}
