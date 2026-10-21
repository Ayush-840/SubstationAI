import { FormEvent, useState } from 'react'
import { api } from '../api/client'
import type { EquipmentClass, QuizQuestionT } from '../types'
import {
  SectionLabel,
  EquipmentFilter,
  type EquipmentCategory,
  Button,
  Wordmark,
} from '../components/common'

interface TopicProgress {
  equipment: string
  topic: string
  completed: number
  total: number
}

export default function Learn() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [topic, setTopic] = useState<string>('all')
  const [questions, setQuestions] = useState<QuizQuestionT[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [score, setScore] = useState<{ score: number; total: number } | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<TopicProgress[]>([])

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
    api.get<TopicProgress[]>('/api/learn/progress').then(setProgress).catch(() => {})
  }, [])

  const generate = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    setScore(null)
    setAnswers({})
    setCurrentQuestion(0)
    setShowResult(false)
    try {
      const res = await api.post<{ questions: QuizQuestionT[] }>('/api/learn/quiz', { topic, count: 5 })
      setQuestions(res.questions)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const submitAnswer = async () => {
    const q = questions[currentQuestion]
    if (!q || answers[q.id] === undefined) return

    setShowResult(true)
    const isCorrect = answers[q.id] === q.correct_index

    if (isCorrect) {
      // Auto-advance after short delay for correct answers
      setTimeout(() => {
        if (currentQuestion < questions.length - 1) {
          setCurrentQuestion(currentQuestion + 1)
          setShowResult(false)
        } else {
          submitQuiz()
        }
      }, 1500)
    }
  }

  const submitQuiz = async () => {
    setError('')
    try {
      const res = await api.post<{ score: number; total: number }>('/api/learn/quiz/submit', {
        topic,
        question_ids: questions.map((q) => q.id),
        answers: questions.map((q) => answers[q.id] ?? -1),
      })
      setScore(res)
      setShowResult(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const currentQ = questions[currentQuestion]

  return (
    <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-display)',
        }}>
          Learn
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Study topics and test your knowledge with sourced quizzes.
        </p>
      </header>

      {/* Topic list / Table of contents */}
      <div style={{ marginBottom: '24px' }}>
        <SectionLabel topRule={false}>Topics</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius)',
              background: topic === 'all' ? 'var(--surface-sunken)' : 'var(--surface)',
              color: topic === 'all' ? 'var(--ink)' : 'var(--muted)',
              fontSize: '15px',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
            onClick={() => setTopic('all')}
          >
            <span>All equipment</span>
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-data)' }}>
              {progress.filter(p => p.equipment).reduce((sum, p) => sum + p.completed, 0)} of {progress.filter(p => p.equipment).reduce((sum, p) => sum + p.total, 0)} done
            </span>
          </button>
          {equipment.map((e) => {
            const p = progress.find(p => p.equipment === e.name)
            return (
              <button
                key={e.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  border: '1px solid var(--rule)',
                  borderRadius: 'var(--radius)',
                  background: topic === e.name ? 'var(--surface-sunken)' : 'var(--surface)',
                  color: topic === e.name ? 'var(--ink)' : 'var(--muted)',
                  fontSize: '15px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
                onClick={() => setTopic(e.name)}
              >
                <span>{e.name}</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-data)' }}>
                  {p ? `${p.completed} of ${p.total} done` : 'No progress'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quiz generation */}
      {questions.length === 0 && (
        <form onSubmit={generate} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SectionLabel topRule={false}>Generate Quiz</SectionLabel>
          <EquipmentFilter selected={topic === 'all' ? 'all' : topic} onChange={(c) => setTopic(c)} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="primary" type="submit" style={{ flex: 1 }}>
              Generate quiz
            </Button>
          </div>
        </form>
      )}

      {error && <p style={{ marginTop: '16px', color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}

      {/* Quiz - one question per screen */}
      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Progress header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Question {currentQuestion + 1} of {questions.length}</span>
              <div style={{ flex: 1, height: '4px', background: 'var(--rule)', borderRadius: 0 }}>
                <div style={{ height: '100%', width: `${((currentQuestion + 1) / questions.length) * 100}%`, background: 'var(--primary)', transition: 'width 200ms ease' }} />
              </div>
            </div>
            {score && (
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                Score: {score.score} / {score.total}
              </span>
            )}
          </div>

          {currentQ && (
            <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '24px' }}>
              <h2 style={{ margin: '0 0 24px', fontSize: '20px', lineHeight: 1.3, color: 'var(--ink)', fontFamily: 'var(--font-display)', maxWidth: '65ch' }}>
                {currentQ.question}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentQ.options.map((opt, oi) => {
                  const chosen = answers[currentQ.id] === oi
                  const isCorrect = currentQ.correct_index === oi
                  const showState = showResult || score != null

                  return (
                    <label
                      key={oi}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: '56px',
                        padding: '0 16px',
                        border: `1px solid ${showState && isCorrect ? 'var(--success)' : showState && chosen && !isCorrect ? 'var(--danger)' : chosen ? 'var(--primary)' : 'var(--rule)'}`,
                        borderRadius: 'var(--radius)',
                        background: showState && isCorrect ? 'color-mix(in srgb, var(--success) 10%, transparent)' : showState && chosen && !isCorrect ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : chosen ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                        cursor: showResult ? 'default' : 'pointer',
                        fontSize: '15px',
                        lineHeight: 1.5,
                        color: 'var(--ink)',
                        fontFamily: 'var(--font-ui)',
                        transition: 'all 100ms',
                      }}
                      onClick={() => !showResult && setAnswers({ ...answers, [currentQ.id]: oi })}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQ.id}`}
                        checked={chosen}
                        style={{ width: '20px', height: '20px', flexShrink: 0, marginRight: '12px', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ flex: 1 }}>{opt}</span>
                      {showState && isCorrect && (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓</span>
                      )}
                      {showState && chosen && !isCorrect && (
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗</span>
                      )}
                    </label>
                  )
                })}
              </div>

              {showResult && (
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--rule)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '14px', color: answers[currentQ.id] === currentQ.correct_index ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {answers[currentQ.id] === currentQ.correct_index ? 'Correct' : 'Not quite'}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
                    {currentQ.explanation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <Button variant="secondary" disabled={currentQuestion === 0 || showResult} onClick={() => { setCurrentQuestion(currentQuestion - 1); setShowResult(false); }}>
              Previous
            </Button>
            <div style={{ display: 'flex', gap: '12px' }}>
              {currentQuestion < questions.length - 1 ? (
                <Button variant="primary" disabled={answers[currentQ?.id] === undefined || showResult} onClick={submitAnswer}>
                  Next
                </Button>
              ) : (
                <Button variant="primary" disabled={answers[currentQ?.id] === undefined || showResult} onClick={submitQuiz}>
                  Submit quiz
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Score display */}
      {score && questions.length > 0 && !showResult && currentQuestion >= questions.length - 1 && (
        <div style={{ marginTop: '24px', padding: '24px', border: '2px solid var(--primary)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            Quiz Complete
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-data)' }}>
            {score.score} / {score.total}
          </p>
          <Button variant="primary" onClick={() => { setQuestions([]); setScore(null); setAnswers({}); setCurrentQuestion(0); }}>Try another topic</Button>
        </div>
      )}
    </div>
  )
}