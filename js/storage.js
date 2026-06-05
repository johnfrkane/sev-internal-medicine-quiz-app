const P = 'mq_'

export function getTheme() {
  return localStorage.getItem(P + 'theme') || 'light'
}
export function setTheme(t) {
  localStorage.setItem(P + 'theme', t)
}

export function getPrefs() {
  try { return JSON.parse(localStorage.getItem(P + 'prefs')) }
  catch { return null }
}
export function setPrefs(p) {
  localStorage.setItem(P + 'prefs', JSON.stringify(p))
}

export function getDecks() {
  try { return JSON.parse(localStorage.getItem(P + 'decks')) || [] }
  catch { return [] }
}
export function setDecks(decks) {
  localStorage.setItem(P + 'decks', JSON.stringify(decks))
}
export function addDeck(deck) {
  const decks = getDecks()
  decks.unshift({ ...deck, id: Date.now() })
  setDecks(decks)
}
export function deleteDeck(id) {
  setDecks(getDecks().filter(d => d.id !== id))
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(P + 'history')) || {} }
  catch { return {} }
}
export function recordResult(questionId, topic, isCorrect) {
  const h = getHistory()
  if (!h[questionId]) h[questionId] = { correct: 0, incorrect: 0, topic, lastSeen: 0 }
  if (isCorrect) h[questionId].correct++
  else h[questionId].incorrect++
  h[questionId].lastSeen = Date.now()
  localStorage.setItem(P + 'history', JSON.stringify(h))
}
export function clearHistory() {
  localStorage.removeItem(P + 'history')
}
export function getStats() {
  const entries = Object.values(getHistory())
  const byTopic = {}
  let totalCorrect = 0, totalAttempted = 0
  for (const e of entries) {
    if (!byTopic[e.topic]) byTopic[e.topic] = { correct: 0, total: 0 }
    byTopic[e.topic].correct += e.correct
    byTopic[e.topic].total += e.correct + e.incorrect
    totalCorrect += e.correct
    totalAttempted += e.correct + e.incorrect
  }
  return { uniqueQuestions: entries.length, totalCorrect, totalAttempted, byTopic }
}
