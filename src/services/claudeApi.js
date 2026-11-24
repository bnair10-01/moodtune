function friendlyMessage(status, detail) {
  if (/credit balance/i.test(detail)) {
    return 'Your Anthropic credit balance is too low. Add credits at console.anthropic.com → Plans & Billing.'
  }
  if (status === 401 || status === 403) {
    return 'Your Anthropic API key was rejected. Check VITE_ANTHROPIC_KEY in your .env file and restart the dev server.'
  }
  if (status === 429) {
    return 'Claude is rate-limited right now. Wait a moment and try again.'
  }
  return "Couldn't reach Claude right now. Try again."
}

export async function callClaude({ system, messages, maxTokens = 1000 }) {
  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages,
      }),
    })
  } catch (err) {
    const error = new Error(`Claude network error: ${err.message}`)
    error.friendlyMessage = friendlyMessage(0, '')
    throw error
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.error?.message ?? ''
    const error = new Error(`Claude API error: ${response.status} ${detail}`)
    error.friendlyMessage = friendlyMessage(response.status, detail)
    throw error
  }

  const data = await response.json()
  return data.content[0].text
}
