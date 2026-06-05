import { loadQuestions, extractTopics, filterQuestions, sampleQuestions, escapeHtml } from './questions.js'
import { createSession, getCurrentQuestion, getProgress, recordAnswer, isSessionComplete, getResults } from './quiz.js'

let allQuestions = []
let session = null
let sessionNotice = null
let flashcards = []
let flashIndex = 0

function showScreen(id) {
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

function showError(message) {
  const banner = document.getElementById('error-banner')
  banner.textContent = message
  banner.classList.remove('hidden')
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden')
}

async function init() {
  try {
    const res = await fetch('data/questions.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    allQuestions = loadQuestions(data)
    renderSetup()
  } catch (err) {
    showScreen('screen-setup')
    showError(`Failed to load question bank: ${err.message}. Ensure data/questions.json exists and is valid JSON.`)
  }
}

function renderSetup() {
  showScreen('screen-setup')
  hideError()
  sessionNotice = null

  const topics = extractTopics(allQuestions)
  const topicList = document.getElementById('topic-list')
  topicList.innerHTML = topics.map(topic => `
    <label>
      <input type="checkbox" value="${escapeHtml(topic)}" checked />
      ${escapeHtml(topic.replace(/_/g, ' '))}
    </label>
  `).join('')

  document.getElementById('select-all-topics').onclick = () => {
    topicList.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true })
  }

  document.getElementById('start-quiz-btn').onclick = startSession
  document.getElementById('start-flash-btn').onclick = startFlashcards
}

function startSession() {
  hideError()
  const filtered = getFilteredQuestions()
  if (!filtered) return

  const countValue = document.getElementById('count-select').value
  const count = countValue === 'all' ? Infinity : parseInt(countValue, 10)
  const sampled = sampleQuestions(filtered, count)

  if (count !== Infinity && filtered.length < count) {
    sessionNotice = `Only ${filtered.length} questions match your filters — using all of them.`
  } else {
    sessionNotice = null
  }

  session = createSession(sampled)
  renderQuestion()
}

function renderQuestion() {
  showScreen('screen-quiz')
  const q = getCurrentQuestion(session)
  const { current, total } = getProgress(session)
  const progressEl = document.getElementById('progress-text')
  progressEl.textContent = `Question ${current} of ${total}`
  if (sessionNotice && current === 1) {
    progressEl.textContent += ` — ${sessionNotice}`
  }
  document.getElementById('next-btn').classList.add('hidden')

  const container = document.getElementById('question-container')
  if (q.type === 'multiple_choice') {
    renderMCQuestion(container, q)
  } else {
    renderFRQuestion(container, q)
  }
}

function showExplanation(container, explanation) {
  if (container.querySelector('.explanation-box')) return
  const box = document.createElement('div')
  box.className = 'explanation-box'
  box.innerHTML = `<strong>Explanation: </strong>${escapeHtml(explanation)}`
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
    </ul>
  `
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
  session.currentIndex++
  showExplanation(container, q.explanation)
}

function renderFRQuestion(container, q) {
  container.innerHTML = `
    <p class="question-text">${escapeHtml(q.question)}</p>
    <div class="fr-answer-area">
      <textarea placeholder="Type your answer here..."></textarea>
    </div>
    <button class="btn-reveal" type="button">Reveal Answer</button>
  `
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
    <button class="btn-self-incorrect" type="button">I got it wrong</button>
  `
  revealed.after(selfMark)

  selfMark.querySelector('.btn-self-correct').addEventListener('click', () => handleFRMark(container, q, true, selfMark))
  selfMark.querySelector('.btn-self-incorrect').addEventListener('click', () => handleFRMark(container, q, false, selfMark))
}

function handleFRMark(container, q, isCorrect, selfMark) {
  selfMark.querySelectorAll('button').forEach(b => { b.disabled = true })
  recordAnswer(session, isCorrect)
  session.currentIndex++
  const expText = (q.explanation || '').trim()
  const ansText = (q.answer || '').trim()
  const redundant = ansText.toLowerCase().startsWith(expText.substring(0, 60).toLowerCase())
  if (expText && !redundant) {
    showExplanation(container, q.explanation)
  } else {
    document.getElementById('next-btn').classList.remove('hidden')
  }
}

function renderResults() {
  showScreen('screen-results')
  const results = getResults(session)

  document.getElementById('score-summary').innerHTML = `
    <div class="score-total">${results.correct}/${results.total}</div>
    <div class="score-label">questions correct</div>
  `

  const rows = Object.entries(results.byTopic)
    .map(([topic, { correct, total }]) => `
      <div class="topic-row">
        <span class="topic-name">${escapeHtml(topic.replace(/_/g, ' '))}</span>
        <span class="topic-score">${correct}/${total}</span>
      </div>
    `).join('')

  document.getElementById('topic-breakdown').innerHTML = `<h3>By Topic</h3>${rows}`
}

function getFilteredQuestions() {
  const selectedTopics = [...document.querySelectorAll('#topic-list input:checked')].map(cb => cb.value)
  if (selectedTopics.length === 0) {
    showError('Please select at least one topic.')
    return null
  }
  const format = document.getElementById('format-select').value
  const filtered = filterQuestions(allQuestions, { topics: selectedTopics, format })
  if (filtered.length === 0) {
    showError('No questions match your filters. Try selecting more topics or a different format.')
    return null
  }
  return filtered
}

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
  showScreen('screen-flashcard')
  const q = flashcards[flashIndex]
  const card = document.getElementById('fc-card')
  card.classList.remove('flipped')

  document.getElementById('flash-progress').textContent =
    `Card ${flashIndex + 1} of ${flashcards.length}`

  document.getElementById('fc-question').innerHTML = escapeHtml(q.question)

  const optionsEl = document.getElementById('fc-options')
  if (q.type === 'multiple_choice') {
    optionsEl.innerHTML = q.options.map(opt =>
      `<div class="fc-option">${escapeHtml(opt)}</div>`
    ).join('')
  } else {
    optionsEl.innerHTML = ''
  }

  const answerEl = document.getElementById('fc-answer')
  if (q.type === 'multiple_choice') {
    const correctOpt = q.options.find(o => o.charAt(0) === q.correct)
    answerEl.innerHTML = `<strong>Answer</strong>${escapeHtml(correctOpt)}`
  } else {
    answerEl.innerHTML = `<strong>Answer</strong>${escapeHtml(q.answer)}`
  }

  document.getElementById('fc-explanation').innerHTML =
    `<strong>Explanation</strong>${escapeHtml(q.explanation)}`

  document.getElementById('fc-prev-btn').disabled = flashIndex === 0
  document.getElementById('fc-next-btn').disabled = flashIndex === flashcards.length - 1
}

document.getElementById('fc-card').addEventListener('click', () => {
  document.getElementById('fc-card').classList.toggle('flipped')
})

document.getElementById('fc-prev-btn').addEventListener('click', () => {
  if (flashIndex > 0) { flashIndex--; renderFlashcard() }
})

document.getElementById('fc-next-btn').addEventListener('click', () => {
  if (flashIndex < flashcards.length - 1) { flashIndex++; renderFlashcard() }
})

document.getElementById('quiz-back-btn').addEventListener('click', () => {
  session = null
  renderSetup()
})

document.getElementById('flash-back-btn').addEventListener('click', () => {
  flashcards = []
  renderSetup()
})

document.getElementById('next-btn').addEventListener('click', () => {
  if (isSessionComplete(session)) {
    renderResults()
  } else {
    renderQuestion()
  }
})

document.getElementById('restart-btn').addEventListener('click', () => {
  session = null
  renderSetup()
})

init()
