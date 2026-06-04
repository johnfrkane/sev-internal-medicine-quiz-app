const REQUIRED_BASE = ['id', 'topic', 'type', 'question', 'explanation']
const REQUIRED_MC = ['options', 'correct']
const REQUIRED_FR = ['answer']

function isValidQuestion(q) {
  if (!q || typeof q !== 'object') return false
  if (!REQUIRED_BASE.every(f => f in q)) return false
  if (q.type === 'multiple_choice') return REQUIRED_MC.every(f => f in q)
  if (q.type === 'free_response') return REQUIRED_FR.every(f => f in q)
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
  return [...questions].sort(() => Math.random() - 0.5).slice(0, count)
}
