export function createSession(questions) {
  return { questions, currentIndex: 0, answers: [] }
}

export function getCurrentQuestion(session) {
  return session.questions[session.currentIndex]
}

export function getProgress(session) {
  return { current: session.currentIndex + 1, total: session.questions.length }
}

export function recordAnswer(session, isCorrect) {
  const q = getCurrentQuestion(session)
  session.answers.push({ questionId: q.id, topic: q.topic, correct: isCorrect })
}

export function isSessionComplete(session) {
  return session.currentIndex >= session.questions.length
}

export function getResults(session) {
  const byTopic = {}
  let correct = 0
  for (const a of session.answers) {
    if (!byTopic[a.topic]) byTopic[a.topic] = { correct: 0, total: 0 }
    byTopic[a.topic].total++
    if (a.correct) { byTopic[a.topic].correct++; correct++ }
  }
  return { correct, total: session.answers.length, byTopic }
}
