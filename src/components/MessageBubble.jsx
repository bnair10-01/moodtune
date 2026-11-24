import GeneratingSpinner from './GeneratingSpinner.jsx'

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isSpinner = message.role === 'spinner'

  if (isSpinner) {
    return (
      <div className="flex justify-start">
        <div
          className="px-4 py-3 rounded-xl"
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--border)',
            borderRadius: '12px 12px 12px 2px',
            maxWidth: '70%',
          }}
        >
          <GeneratingSpinner />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        style={{
          maxWidth: '75%',
          padding: '10px 14px',
          fontSize: '14px',
          lineHeight: '1.5',
          color: 'var(--text-primary)',
          ...(isUser
            ? {
                background: '#1a1a2e',
                borderRadius: '12px 12px 2px 12px',
              }
            : {
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--border)',
                borderRadius: '12px 12px 12px 2px',
              }),
        }}
      >
        {message.content}
      </div>
    </div>
  )
}
