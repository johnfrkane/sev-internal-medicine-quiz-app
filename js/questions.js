const REQUIRED_BASE = ['id', 'topic', 'type', 'question', 'explanation']
const REQUIRED_MC = ['options', 'correct']
const REQUIRED_FR = ['answer']

function isValidQuestion(q) {
  if (!q || typeof q !== 'object') return false
  if (!REQUIRED_BASE.every(f => f in q)) return false
  if (q.type === 'multiple_choice') {
    if (!Array.isArray(q.options) || q.options.length === 0) return false
    if (typeof q.correct !== 'string') return false
    return q.options.some(opt => typeof opt === 'string' && opt.charAt(0) === q.correct)
  }
  if (q.type === 'free_response') return typeof q.answer === 'string' && q.answer.length > 0
  return false
}

export function loadQuestions(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid question bank: expected an object')
  if (!Array.isArray(data.questions)) throw new Error('Invalid question bank: missing questions array')
  const valid = []
  for (const q of data.questions) {
    if (isValidQuestion(q)) {
      valid.push(q)
    } else {
      console.warn('Skipping invalid question:', q?.id ?? '(no id)')
    }
  }
  return valid
}

export function extractTopics(questions) {
  return [...new Set(questions.map(q => q.topic))].sort()
}

export function filterQuestions(questions, { topics, format }) {
  if (!Array.isArray(topics)) return []
  return questions.filter(q => {
    const topicMatch = topics.includes(q.topic)
    const formatMatch = format === 'mixed' || q.type === format
    return topicMatch && formatMatch
  })
}

export function sampleQuestions(questions, count) {
  if (count <= 0) return []
  if (questions.length <= count) return [...questions]
  const arr = [...questions]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, count)
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
