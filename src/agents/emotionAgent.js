import { callClaude } from '../services/claudeApi.js'
import { parseJson } from '../utils/parseJson.js'
import { DEFAULT_PREFERENCES, normalizePreferences } from '../utils/emotionHelpers.js'

const SYSTEM = `You are an emotion analysis agent. Given a conversation, extract the user's
current emotional state from their latest message and full conversation context,
plus any explicit listening preferences they have stated.

Reason from both explicit statements ("I feel devastated") and implicit cues
("my meeting got cancelled again, nothing's going right").

If the latest message contains no new emotional content (for example "give me
classical instead"), keep the previous emotional state and only update preferences.

Listening preferences describe WHAT the user wants to hear, not how they feel.
They persist across turns: carry forward the previous preferences unless the user
changes, replaces or cancels them (e.g. "any genre is fine", "forget classical").
If the user names a new genre, it replaces the old genres.

Return ONLY valid JSON — no markdown fences, no explanation, no preamble:
{
  "valence": <0.0–1.0, where 0=very negative, 1=very positive>,
  "arousal": <0.0–1.0, where 0=very calm, 1=very intense>,
  "labels": [<2–4 emotion words>],
  "mood_quadrant": <"happy"|"sad"|"angry"|"relaxed">,
  "sub_emotion": <one specific word, e.g. "nostalgic","grieving","anxious","euphoric","wistful","restless">,
  "intensity": <0.0–1.0>,
  "confidence": <0.0–1.0>,
  "shift_detected": <true if this meaningfully differs from the prior emotional state>,
  "preferences": {
    "genres": [<genres the user asked for, lowercase, e.g. "classical","hip hop","k-pop"; [] if none>],
    "recency": <"new_releases" if they want the newest/latest/just-released music, "recent" if they want recent/current/modern/new music, otherwise "any">,
    "vocals": <"with_lyrics" if they want songs with lyrics/singing/vocals, "instrumental" if they want no vocals/instrumental/classical-style, otherwise "any">,
    "language": <language of music they asked for, e.g. "hindi", "spanish", or null>,
    "era": <decade or era they asked for, e.g. "90s", "80s", or null>,
    "artists": [<artists they named, [] if none>],
    "notes": <any other listening request, e.g. "for working out", or "">
  }
}`

const SAFE_DEFAULT = {
  valence: 0.5,
  arousal: 0.5,
  labels: ['neutral'],
  mood_quadrant: 'relaxed',
  sub_emotion: 'calm',
  intensity: 0.3,
  confidence: 0.2,
  shift_detected: false,
  preferences: DEFAULT_PREFERENCES,
}

export async function extractEmotion(messages, prevEmotion) {
  try {
    const contextMsg = prevEmotion
      ? `Previous emotional state and preferences: ${JSON.stringify(prevEmotion)}\n\nConversation:`
      : 'Conversation:'

    const userContent = `${contextMsg}\n${messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')}`

    const text = await callClaude({
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 600,
    })

    const parsed = parseJson(text)
    return {
      ...SAFE_DEFAULT,
      ...parsed,
      preferences: normalizePreferences(parsed.preferences),
    }
  } catch (err) {
    console.error('emotionAgent error:', err)
    return {
      ...(prevEmotion ?? SAFE_DEFAULT),
      failed: true,
      errorMessage:
        err.friendlyMessage ?? "I couldn't read your mood just now. Try rephrasing and send it again.",
    }
  }
}
