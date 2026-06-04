import { describe, it, expect } from 'vitest'
import { loadQuestions, extractTopics, filterQuestions, sampleQuestions } from '../js/questions.js'

const validMC = {
  id: '001', topic: 'cardiology', difficulty: 'medium', type: 'multiple_choice',
  question: 'Q?', options: ['A. a', 'B. b', 'C. c', 'D. d'], correct: 'B', explanation: 'E'
}
const validFR = {
  id: '002', topic: 'nephrology', difficulty: 'hard', type: 'free_response',
  question: 'Q2?', answer: 'A2', explanation: 'E2'
}

describe('loadQuestions', () => {
  it('returns valid questions from well-formed data', () => {
    expect(loadQuestions({ questions: [validMC, validFR] })).toHaveLength(2)
  })

  it('skips questions missing required fields', () => {
    expect(loadQuestions({ questions: [validMC, { id: '003' }] })).toHaveLength(1)
  })

  it('throws on non-object input', () => {
    expect(() => loadQuestions(null)).toThrow()
    expect(() => loadQuestions('bad')).toThrow()
  })

  it('throws when questions array is missing', () => {
    expect(() => loadQuestions({})).toThrow()
  })
})

describe('extractTopics', () => {
  it('returns sorted unique topics', () => {
    expect(extractTopics([validMC, validFR])).toEqual(['cardiology', 'nephrology'])
  })

  it('returns empty array for empty input', () => {
    expect(extractTopics([])).toEqual([])
  })

  it('deduplicates topics when multiple questions share the same topic', () => {
    const q2 = { ...validMC, id: '003' }
    expect(extractTopics([validMC, q2])).toEqual(['cardiology'])
  })
})

describe('filterQuestions', () => {
  it('filters by topic', () => {
    const result = filterQuestions([validMC, validFR], { topics: ['cardiology'], format: 'mixed' })
    expect(result).toHaveLength(1)
    expect(result[0].topic).toBe('cardiology')
  })

  it('filters by multiple_choice format', () => {
    const result = filterQuestions([validMC, validFR], { topics: ['cardiology', 'nephrology'], format: 'multiple_choice' })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('multiple_choice')
  })

  it('filters by free_response format', () => {
    const result = filterQuestions([validMC, validFR], { topics: ['cardiology', 'nephrology'], format: 'free_response' })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('free_response')
  })

  it('returns all types when format is mixed', () => {
    const result = filterQuestions([validMC, validFR], { topics: ['cardiology', 'nephrology'], format: 'mixed' })
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no topics match', () => {
    const result = filterQuestions([validMC, validFR], { topics: ['pulmonology'], format: 'mixed' })
    expect(result).toHaveLength(0)
  })
})

describe('sampleQuestions', () => {
  it('returns up to count questions', () => {
    const qs = [validMC, validFR, { ...validMC, id: '003' }]
    expect(sampleQuestions(qs, 2)).toHaveLength(2)
  })

  it('returns all when count exceeds available', () => {
    expect(sampleQuestions([validMC, validFR], 10)).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(sampleQuestions([], 5)).toHaveLength(0)
  })

  it('returns empty array when count is 0 or negative', () => {
    expect(sampleQuestions([validMC, validFR], 0)).toHaveLength(0)
    expect(sampleQuestions([validMC, validFR], -5)).toHaveLength(0)
  })
})
