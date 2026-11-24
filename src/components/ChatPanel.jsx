import { useEffect, useRef, useState } from 'react'
import useAppStore from '../store/appStore.js'
import MessageBubble from './MessageBubble.jsx'

export default function ChatPanel({ onSend }) {
  const messages = useAppStore((s) => s.messages)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isGenerating) return
    setInput('')
    onSend(text)
  }

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100%',
        borderRight: '0.5px solid var(--border)',
        background: 'var(--bg-base)',
      }}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div
            className="flex-1 flex flex-col items-center justify-center text-center"
            style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}
          >
            <p style={{ fontSize: '24px', marginBottom: '12px' }}>🎵</p>
            <p style={{ fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              How are you feeling?
            </p>
            <p>Tell me what's on your mind and I'll tune a playlist to your mood.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3"
        style={{ borderTop: '0.5px solid var(--border)' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me how you're feeling..."
          disabled={isGenerating}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
          }}
        />
        <button
          type="submit"
          disabled={isGenerating || !input.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium flex-shrink-0"
          style={{
            background: isGenerating || !input.trim() ? 'var(--bg-surface)' : 'var(--accent-gold)',
            color: isGenerating || !input.trim() ? 'var(--text-muted)' : '#0d0d12',
            border: 'none',
            cursor: isGenerating || !input.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            fontSize: '14px',
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
