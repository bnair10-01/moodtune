export function parseJson(text) {
  let s = String(text).trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    return JSON.parse(s)
  } catch {
    const starts = [s.indexOf('{'), s.indexOf('[')].filter((i) => i !== -1)
    if (starts.length === 0) throw new Error('No JSON found in response')
    const start = Math.min(...starts)
    const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
    return JSON.parse(s.slice(start, end + 1))
  }
}
