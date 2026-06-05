import { loadQuestions, extractTopics, filterQuestions, sampleQuestions, escapeHtml } from './questions.js'
import { createSession, getCurrentQuestion, getProgress, recordAnswer, isSessionComplete, getResults } from './quiz.js'
import { getTheme, setTheme, getPrefs, setPrefs, getDecks, addDeck, deleteDeck, getStats, recordResult, clearHistory } from './storage.js'

// ─── Topic colors ─────────────────────────────────────────────────────────────
const TOPIC_COLORS = {
  cardiology:         '#ef4444',
  pulmonology:        '#0ea5e9',
  nephrology:         '#14b8a6',
  gastroenterology:   '#f59e0b',
  endocrinology:      '#a855f7',
  hematology:         '#f43f5e',
  infectious_disease: '#22c55e',
  perioperative:      '#64748b',
}

function topicPill(topic) {
  const c = TOPIC_COLORS[topic] || '#64748b'
  return `<span class="topic-pill" style="background:${c}22;color:${c};border:1px solid ${c}44">${escapeHtml(topic.replace(/_/g, ' '))}</span>`
}

// ─── State ────────────────────────────────────────────────────────────────────
let allQuestions = []
let session = null
let sessionNotice = null
let flashcards = []
let flashIndex = 0

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  const isDark = theme === 'dark'
  const settingsBtn = document.getElementById('settings-theme-btn')
  if (settingsBtn) settingsBtn.setAttribute('aria-checked', isDark ? 'true' : 'false')
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  applyTheme(next)
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function navigate(viewId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'))
  document.getElementById('screen-' + viewId).classList.remove('hidden')
  const navId = { quiz: 'setup', flashcard: 'setup', results: 'setup' }[viewId] || viewId
  document.querySelectorAll('.nav-item, .bottom-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === navId)
  })
}

// ─── Errors ───────────────────────────────────────────────────────────────────
function showError(msg) {
  const b = document.getElementById('error-banner')
  b.textContent = msg
  b.classList.remove('hidden')
}
function hideError() {
  document.getElementById('error-banner').classList.add('hidden')
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  applyTheme(getTheme())
  try {
    const res = await fetch('data/questions.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    allQuestions = loadQuestions(await res.json())
  } catch (err) {
    showError(`Failed to load question bank: ${err.message}`)
  }
  renderSetup()
}

// ─── Setup ────────────────────────────────────────────────────────────────────
function renderSetup() {
  hideError()
  sessionNotice = null
  const prefs = getPrefs()
  const topics = extractTopics(allQuestions)
  const topicList = document.getElementById('topic-list')

  topicList.innerHTML = topics.map(topic => {
    const c = TOPIC_COLORS[topic] || '#64748b'
    const checked = !prefs || prefs.topics.includes(topic)
    return `<label class="topic-label">
      <input type="checkbox" value="${escapeHtml(topic)}" ${checked ? 'checked' : ''} />
      <span class="topic-dot" style="--tc:${c}"></span>
      ${escapeHtml(topic.replace(/_/g, ' '))}
    </label>`
  }).join('')

  if (prefs) {
    const fmt = document.getElementById('format-select')
    const cnt = document.getElementById('count-select')
    if (fmt) fmt.value = prefs.format || 'mixed'
    if (cnt) cnt.value = prefs.count || '10'
  }

  navigate('setup')
}

function getSelectedTopics() {
  return [...document.querySelectorAll('#topic-list input:checked')].map(cb => cb.value)
}

function getFilteredQuestions() {
  const topics = getSelectedTopics()
  if (topics.length === 0) { showError('Please select at least one topic.'); return null }
  const format = document.getElementById('format-select').value
  const filtered = filterQuestions(allQuestions, { topics, format })
  if (filtered.length === 0) { showError('No questions match your filters.'); return null }
  setPrefs({ topics, format, count: document.getElementById('count-select').value })
  return filtered
}

function saveDeck() {
  const name = document.getElementById('deck-name').value.trim()
  if (!name) { showError('Enter a name for the deck.'); return }
  const topics = getSelectedTopics()
  if (topics.length === 0) { showError('Select at least one topic.'); return }
  hideError()
  addDeck({
    name,
    topics,
    format: document.getElementById('format-select').value,
    count: document.getElementById('count-select').value,
  })
  document.getElementById('deck-name').value = ''
  const btn = document.getElementById('save-deck-btn')
  const orig = btn.textContent
  btn.textContent = 'Saved!'
  setTimeout(() => { btn.textContent = orig }, 1500)
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────
function startSession() {
  hideError()
  const filtered = getFilteredQuestions()
  if (!filtered) return
  const countValue = document.getElementById('count-select').value
  const count = countValue === 'all' ? Infinity : parseInt(countValue, 10)
  const sampled = sampleQuestions(filtered, count)
  sessionNotice = (count !== Infinity && filtered.length < count)
    ? `Only ${filtered.length} available — using all.`
    : null
  session = createSession(sampled)
  renderQuestion()
}

function renderQuestion() {
  navigate('quiz')
  const q = getCurrentQuestion(session)
  const { current, total } = getProgress(session)
  const progressEl = document.getElementById('progress-text')
  progressEl.textContent = `Question ${current} of ${total}`
  if (sessionNotice && current === 1) progressEl.textContent += ` — ${sessionNotice}`
  document.getElementById('next-btn').classList.add('hidden')
  document.getElementById('question-topic-tag').innerHTML = topicPill(q.topic)
  const container = document.getElementById('question-container')
  if (q.type === 'multiple_choice') renderMCQuestion(container, q)
  else renderFRQuestion(container, q)
}

function showExplanation(container, explanation) {
  if (container.querySelector('.explanation-box')) return
  const box = document.createElement('div')
  box.className = 'explanation-box'
  box.innerHTML = `<strong>Explanation</strong>${escapeHtml(explanation)}`
  container.appendChild(box)
  document.getElementById('next-btn').classList.remove('hidden')
}

function renderMCQuestion(container, q) {
  container.innerHTML = `
    <p class="question-text">${escapeHtml(q.question)}</p>
    <ul class="options-list">
      ${q.options.map((opt, i) => `
        <li><button class="option-btn" data-index="${i}">${escapeHtml(opt)}</button></li>
      `).join('')}
    </ul>`
  container.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMCAnswer(container, q, btn))
  })
}

function handleMCAnswer(container, q, selectedBtn) {
  container.querySelectorAll('.option-btn').forEach(btn => { btn.disabled = true })
  const selectedLetter = q.options[parseInt(selectedBtn.dataset.index, 10)].charAt(0)
  const isCorrect = selectedLetter === q.correct
  container.querySelectorAll('.option-btn').forEach(btn => {
    const letter = q.options[parseInt(btn.dataset.index, 10)].charAt(0)
    if (letter === q.correct) btn.classList.add('correct')
    else if (btn === selectedBtn) btn.classList.add('incorrect')
  })
  recordAnswer(session, isCorrect)
  recordResult(q.id, q.topic, isCorrect)
  session.currentIndex++
  showExplanation(container, q.explanation)
}

function renderFRQuestion(container, q) {
  container.innerHTML = `
    <p class="question-text">${escapeHtml(q.question)}</p>
    <div class="fr-answer-area"><textarea placeholder="Type your answer here..."></textarea></div>
    <button class="btn-reveal" type="button">Reveal Answer</button>`
  container.querySelector('.btn-reveal').addEventListener('click', () => handleReveal(container, q))
}

function handleReveal(container, q) {
  container.querySelector('.btn-reveal').remove()
  const revealed = document.createElement('div')
  revealed.className = 'revealed-answer'
  revealed.innerHTML = `<strong>Answer</strong>${escapeHtml(q.answer)}`
  container.querySelector('.fr-answer-area').after(revealed)
  const selfMark = document.createElement('div')
  selfMark.className = 'self-mark'
  selfMark.innerHTML = `
    <button class="btn-self-correct" type="button">I got it right</button>
    <button class="btn-self-incorrect" type="button">I got it wrong</button>`
  revealed.after(selfMark)
  selfMark.querySelector('.btn-self-correct').addEventListener('click', () => handleFRMark(container, q, true, selfMark))
  selfMark.querySelector('.btn-self-incorrect').addEventListener('click', () => handleFRMark(container, q, false, selfMark))
}

function handleFRMark(container, q, isCorrect, selfMark) {
  selfMark.querySelectorAll('button').forEach(b => { b.disabled = true })
  recordAnswer(session, isCorrect)
  recordResult(q.id, q.topic, isCorrect)
  session.currentIndex++
  const exp = (q.explanation || '').trim()
  const ans = (q.answer || '').trim()
  const redundant = ans.toLowerCase().startsWith(exp.substring(0, 60).toLowerCase())
  if (exp && !redundant) showExplanation(container, q.explanation)
  else document.getElementById('next-btn').classList.remove('hidden')
}

function renderResults() {
  navigate('results')
  const results = getResults(session)
  document.getElementById('score-summary').innerHTML = `
    <div class="score-total">${results.correct}/${results.total}</div>
    <div class="score-label">questions correct</div>`
  const rows = Object.entries(results.byTopic).map(([topic, { correct, total }]) => {
    const c = TOPIC_COLORS[topic] || '#64748b'
    const pct = total > 0 ? Math.round(correct / total * 100) : 0
    return `<div class="topic-row">
      <span class="topic-dot" style="--tc:${c}"></span>
      <span class="topic-name">${escapeHtml(topic.replace(/_/g, ' '))}</span>
      <span class="topic-score">${correct}/${total}</span>
      <div class="topic-bar-wrap"><div class="topic-bar" style="width:${pct}%;background:${c}"></div></div>
    </div>`
  }).join('')
  document.getElementById('topic-breakdown').innerHTML = `<h3>By Topic</h3>${rows}`
}

// ─── Flashcards ───────────────────────────────────────────────────────────────
function startFlashcards() {
  hideError()
  const filtered = getFilteredQuestions()
  if (!filtered) return
  const countValue = document.getElementById('count-select').value
  const count = countValue === 'all' ? Infinity : parseInt(countValue, 10)
  flashcards = sampleQuestions(filtered, count)
  flashIndex = 0
  renderFlashcard()
}

function renderFlashcard() {
  navigate('flashcard')
  const q = flashcards[flashIndex]
  document.getElementById('fc-card').classList.remove('flipped')
  document.getElementById('flash-progress').textContent = `Card ${flashIndex + 1} of ${flashcards.length}`
  document.getElementById('flash-topic-tag').innerHTML = topicPill(q.topic)
  document.getElementById('fc-question').innerHTML = escapeHtml(q.question)

  const optionsEl = document.getElementById('fc-options')
  optionsEl.innerHTML = q.type === 'multiple_choice'
    ? q.options.map(opt => `<div class="fc-option">${escapeHtml(opt)}</div>`).join('')
    : ''

  const answerEl = document.getElementById('fc-answer')
  if (q.type === 'multiple_choice') {
    const correct = q.options.find(o => o.charAt(0) === q.correct)
    answerEl.innerHTML = `<strong>Answer</strong>${escapeHtml(correct)}`
  } else {
    answerEl.innerHTML = `<strong>Answer</strong>${escapeHtml(q.answer)}`
  }
  document.getElementById('fc-explanation').innerHTML = `<strong>Explanation</strong>${escapeHtml(q.explanation)}`
  document.getElementById('fc-prev-btn').disabled = flashIndex === 0
  document.getElementById('fc-next-btn').disabled = flashIndex === flashcards.length - 1
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function renderStats() {
  const stats = getStats()
  const el = document.getElementById('stats-content')
  if (stats.totalAttempted === 0) {
    el.innerHTML = '<p class="empty-state">No study history yet. Complete a quiz or flashcard session to see your stats here.</p>'
    return
  }
  const pct = Math.round(stats.totalCorrect / stats.totalAttempted * 100)
  const topicRows = Object.entries(stats.byTopic).map(([topic, { correct, total }]) => {
    const tp = total > 0 ? Math.round(correct / total * 100) : 0
    const c = TOPIC_COLORS[topic] || '#64748b'
    return `<div class="stat-topic-row">
      <div class="stat-topic-header">
        <span class="topic-dot" style="--tc:${c}"></span>
        <span class="stat-topic-name">${escapeHtml(topic.replace(/_/g, ' '))}</span>
        <span class="stat-topic-score">${correct}/${total} &middot; ${tp}%</span>
      </div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${tp}%;background:${c}"></div></div>
    </div>`
  }).join('')
  el.innerHTML = `
    <div class="stats-overview">
      <div class="stat-card">
        <div class="stat-number">${stats.uniqueQuestions}</div>
        <div class="stat-label">Questions Seen</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.totalAttempted}</div>
        <div class="stat-label">Total Attempts</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${pct}%</div>
        <div class="stat-label">Accuracy</div>
      </div>
    </div>
    <h3>By Topic</h3>
    ${topicRows}`
}

// ─── Decks ────────────────────────────────────────────────────────────────────
function renderDecks() {
  const decks = getDecks()
  const el = document.getElementById('decks-content')
  if (decks.length === 0) {
    el.innerHTML = '<p class="empty-state">No saved decks yet. Configure a session, give it a name in the Deck field, and click Save.</p>'
    return
  }
  el.innerHTML = decks.map(deck => `
    <div class="deck-card">
      <div class="deck-info">
        <div class="deck-name">${escapeHtml(deck.name)}</div>
        <div class="deck-meta">
          ${deck.topics.map(t => `<span class="topic-dot" style="--tc:${TOPIC_COLORS[t] || '#64748b'}"></span>`).join('')}
          <span class="deck-detail">${deck.topics.length} topic${deck.topics.length !== 1 ? 's' : ''}</span>
          <span class="deck-sep">&middot;</span>
          <span class="deck-detail">${deck.format.replace(/_/g, ' ')}</span>
          <span class="deck-sep">&middot;</span>
          <span class="deck-detail">${deck.count === 'all' ? 'All' : deck.count} Qs</span>
        </div>
      </div>
      <div class="deck-actions">
        <button class="btn-deck-play" data-id="${deck.id}" type="button">Quiz</button>
        <button class="btn-deck-flash" data-id="${deck.id}" type="button">Flash</button>
        <button class="btn-deck-delete" data-id="${deck.id}" type="button" aria-label="Delete">&#215;</button>
      </div>
    </div>`).join('')

  el.querySelectorAll('.btn-deck-play').forEach(btn =>
    btn.addEventListener('click', () => loadDeck(parseInt(btn.dataset.id, 10), 'quiz')))
  el.querySelectorAll('.btn-deck-flash').forEach(btn =>
    btn.addEventListener('click', () => loadDeck(parseInt(btn.dataset.id, 10), 'flash')))
  el.querySelectorAll('.btn-deck-delete').forEach(btn =>
    btn.addEventListener('click', () => { deleteDeck(parseInt(btn.dataset.id, 10)); renderDecks() }))
}

function loadDeck(id, mode) {
  const deck = getDecks().find(d => d.id === id)
  if (!deck) return
  const filtered = filterQuestions(allQuestions, { topics: deck.topics, format: deck.format })
  const count = deck.count === 'all' ? Infinity : parseInt(deck.count, 10)
  const sampled = sampleQuestions(filtered, count)
  if (sampled.length === 0) { alert('No questions match this deck.'); return }
  if (mode === 'quiz') {
    session = createSession(sampled)
    sessionNotice = null
    renderQuestion()
  } else {
    flashcards = sampled
    flashIndex = 0
    renderFlashcard()
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  const isDark = getTheme() === 'dark'
  document.getElementById('settings-theme-btn').setAttribute('aria-checked', isDark ? 'true' : 'false')
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
document.getElementById('select-all-topics').addEventListener('click', () => {
  document.querySelectorAll('#topic-list input[type="checkbox"]').forEach(cb => { cb.checked = true })
})
document.getElementById('start-quiz-btn').addEventListener('click', startSession)
document.getElementById('start-flash-btn').addEventListener('click', startFlashcards)
document.getElementById('save-deck-btn').addEventListener('click', saveDeck)

document.getElementById('fc-card').addEventListener('click', () => {
  document.getElementById('fc-card').classList.toggle('flipped')
})
document.getElementById('fc-prev-btn').addEventListener('click', () => {
  if (flashIndex > 0) { flashIndex--; renderFlashcard() }
})
document.getElementById('fc-next-btn').addEventListener('click', () => {
  if (flashIndex < flashcards.length - 1) { flashIndex++; renderFlashcard() }
})

// Keyboard shortcuts for flashcards
document.addEventListener('keydown', e => {
  if (document.getElementById('screen-flashcard').classList.contains('hidden')) return
  if (e.target.matches('input, textarea, select, button')) return
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    document.getElementById('fc-card').classList.toggle('flipped')
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    if (flashIndex < flashcards.length - 1) { flashIndex++; renderFlashcard() }
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (flashIndex > 0) { flashIndex--; renderFlashcard() }
  }
})

document.getElementById('quiz-back-btn').addEventListener('click', () => { session = null; renderSetup() })
document.getElementById('flash-back-btn').addEventListener('click', () => { flashcards = []; renderSetup() })
document.getElementById('next-btn').addEventListener('click', () => {
  if (isSessionComplete(session)) renderResults()
  else renderQuestion()
})
document.getElementById('restart-btn').addEventListener('click', () => { session = null; renderSetup() })

document.getElementById('theme-toggle').addEventListener('click', toggleTheme)
document.getElementById('settings-theme-btn').addEventListener('click', () => {
  toggleTheme()
  renderSettings()
})
document.getElementById('clear-history-btn').addEventListener('click', () => {
  if (confirm('Clear all study history? This cannot be undone.')) {
    clearHistory()
    renderSettings()
    if (!document.getElementById('screen-stats').classList.contains('hidden')) renderStats()
  }
})

document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.nav
    if (view === 'setup') renderSetup()
    else if (view === 'stats') { renderStats(); navigate('stats') }
    else if (view === 'decks') { renderDecks(); navigate('decks') }
    else if (view === 'settings') { renderSettings(); navigate('settings') }
  })
})

init()
