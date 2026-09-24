import { FormEvent, useState } from 'react'
import { api } from '../api/client'
import type { EquipmentClass, QuizQuestionT } from '../types'

export default function Learn() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [topic, setTopic] = useState('all')
  const [questions, setQuestions] = useState<QuizQuestionT[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [score, setScore] = useState<{ score: number; total: number } | null>(null)
  const [error, setError] = useState('')

  useState(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  })

  const generate = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    setScore(null)
    setAnswers({})
    try {
      const res = await api.post<{ questions: QuizQuestionT[] }>('/api/learn/quiz', { topic, count: 5 })
      setQuestions(res.questions)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const submit = async () => {
    setError('')
    try {
      const res = await api.post<{ score: number; total: number }>('/api/learn/quiz/submit', {
        topic,
        question_ids: questions.map((q) => q.id),
        answers: questions.map((q) => answers[q.id] ?? -1),
      })
      setScore(res)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Learn Mode</h2>
        <p className="text-sm text-muted">
          Practice quizzes built from the verified test catalog — every answer is sourced.
        </p>
      </div>

      <form onSubmit={generate} className="card flex flex-wrap items-end gap-2">
        <select className="input max-w-xs" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">All equipment</option>
          {equipment.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
        <button className="btn-primary">Generate quiz</button>
      </form>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((q, qi) => (
            <div key={q.id} className="card space-y-2">
              <p className="font-medium">{qi + 1}. {q.question}</p>
              <div className="grid gap-1.5">
                {q.options.map((opt, oi) => {
                  const chosen = answers[q.id] === oi
                  const isCorrect = q.correct_index === oi
                  const showState = score != null
                  return (
                    <label key={oi} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-control border px-3 text-sm
                      ${showState && isCorrect ? 'border-success bg-success/10' : ''}
                      ${showState && chosen && !isCorrect ? 'border-danger bg-danger/10' : ''}
                      ${!showState && chosen ? 'border-primary bg-primary/10' : 'border-brdr'}`}>
                      <input type="radio" name={`q-${q.id}`} className="accent-[var(--primary)]"
                             checked={chosen} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                      {opt}
                    </label>
                  )
                })}
              </div>
              {score != null && <p className="text-xs text-muted">{q.explanation}</p>}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={Object.keys(answers).length < questions.length} onClick={submit}>
              Submit answers
            </button>
            {score && (
              <p className="text-sm font-medium">
                Score: {score.score} / {score.total}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
