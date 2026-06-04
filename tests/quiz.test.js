import { describe, it, expect } from 'vitest'
import { createSession, getCurrentQuestion, getProgress, recordAnswer, isSessionComplete, getResults } from '../js/quiz.js'

const questions = [
  { id: '1', topic: 'cardiology', type: 'multiple_choice', question: 'Q1', options: ['A. a'], correct: 'A', explanation: 'E' },
  { id: '2', topic: 'nephrology', type: 'free_response', question: 'Q2', answer: 'A2', explanation: 'E2' },
  { id: '3', topic: 'cardiology', type: 'multiple_choice', question: 'Q3', options: ['A. a'], correct: 'A', explanation: 'E' }
]

describe('createSession', () => {
  it('initialises with index 0 and empty answers', () => {
    const s = createSession(questions)
    expect(s.currentIndex).toBe(0)
    expect(s.answers).toHaveLength(0)
    expect(s.questions).toBe(questions)
  })
})

describe('getCurrentQuestion', () => {
  it('returns the question at currentIndex', () => {
    const s = createSession(questions)
    expect(getCurrentQuestion(s)).toBe(questions[0])
  })
})

describe('getProgress', () => {
  it('returns 1-based current and total', () => {
    expect(getProgress(createSession(questions))).toEqual({ current: 1, total: 3 })
  })

  it('reflects updated index', () => {
    const s = createSession(questions)
    s.currentIndex = 2
    expect(getProgress(s)).toEqual({ current: 3, total: 3 })
  })
})

describe('recordAnswer', () => {
  it('appends answer with questionId, topic, and correct flag', () => {
    const s = createSession(questions)
    recordAnswer(s, true)
    expect(s.answers[0]).toEqual({ questionId: '1', topic: 'cardiology', correct: true })
  })

  it('records incorrect answers', () => {
    const s = createSession(questions)
    recordAnswer(s, false)
    expect(s.answers[0].correct).toBe(false)
  })
})

describe('isSessionComplete', () => {
  it('returns false when questions remain', () => {
    expect(isSessionComplete(createSession(questions))).toBe(false)
  })

  it('returns true when currentIndex equals questions length', () => {
    const s = createSession(questions)
    s.currentIndex = 3
    expect(isSessionComplete(s)).toBe(true)
  })
})

describe('getResults', () => {
  it('calculates total score and per-topic breakdown', () => {
    const s = createSession(questions)
    recordAnswer(s, true); s.currentIndex++   // cardiology correct
    recordAnswer(s, false); s.currentIndex++  // nephrology incorrect
    recordAnswer(s, true); s.currentIndex++   // cardiology correct

    const r = getResults(s)
    expect(r.correct).toBe(2)
    expect(r.total).toBe(3)
    expect(r.byTopic.cardiology).toEqual({ correct: 2, total: 2 })
    expect(r.byTopic.nephrology).toEqual({ correct: 0, total: 1 })
  })
})
