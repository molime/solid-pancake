import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import type { QuizQuestion } from '../model/courseTypes'

const CONFETTI_COLORS = ['#16a34a', '#f0b429', '#4d8df6', '#a855f7', '#f0564a']
const CONFETTI_PIECES = Array.from({ length: 20 }, (_, i) => ({
  left: (i * 37) % 100,
  color: CONFETTI_COLORS[i % 5],
  delay: (i * 0.07) % 0.5,
}))

type QuizResult = { score: number; passed: boolean }

export function QuizPlayer({
  questions,
  passThreshold,
  speedrun,
  onComplete,
}: {
  questions: QuizQuestion[]
  passThreshold: number
  speedrun?: boolean
  onComplete: () => void
}) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [feedback, setFeedback] = useState<{ correct: boolean; index: number } | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [streak, setStreak] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)

  // Dev speed-run: instantly mark the quiz as passed without forcing answers.
  useEffect(() => {
    if (!speedrun) return
    setResult({ score: 100, passed: true })
    setShowConfetti(true)
    onComplete()
  }, [speedrun, onComplete])

  const total = questions.length
  const progress = Math.round(
    ((currentQuestion + (feedback ? 1 : 0)) / total) * 100,
  )

  const handleAnswer = (optionIndex: number) => {
    if (feedback) return
    const next = [...answers]
    next[currentQuestion] = optionIndex
    setAnswers(next)
    const isCorrect = optionIndex === questions[currentQuestion].correct
    setFeedback({ correct: isCorrect, index: optionIndex })
    setStreak((s) => (isCorrect ? s + 1 : 0))
  }

  const handleNext = () => {
    setFeedback(null)
    if (currentQuestion < total - 1) {
      setCurrentQuestion((q) => q + 1)
    } else {
      const correct = questions.filter((q, i) => answers[i] === q.correct).length
      const score = Math.round((correct / total) * 100)
      const passed = score >= passThreshold
      setResult({ score, passed })
      if (passed) {
        setShowConfetti(true)
        onComplete()
      }
    }
  }

  const handleRetry = () => {
    setCurrentQuestion(0)
    setAnswers([])
    setFeedback(null)
    setResult(null)
    setStreak(0)
    setShowConfetti(false)
  }

  if (result) {
    return (
      <div className="relative mb-4 text-center">
        {showConfetti && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {CONFETTI_PIECES.map((piece, i) => (
              <div
                key={i}
                className="training-confetti"
                style={{
                  left: `${piece.left}%`,
                  top: '0%',
                  backgroundColor: piece.color,
                  animationDelay: `${piece.delay}s`,
                }}
              />
            ))}
          </div>
        )}
        {result.passed ? (
          <>
            <div className="training-animate-star-burst mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-atria-success text-white">
              <span className="text-4xl">🎉</span>
            </div>
            <h2
              className="training-animate-fade-up mb-2 text-xl font-bold text-atria-ink"
              style={{ opacity: 0, animationDelay: '0.2s' }}
            >
              Quiz passed! You scored {result.score}%
            </h2>
            <p
              className="training-animate-fade-up text-sm text-atria-text-secondary"
              style={{ opacity: 0, animationDelay: '0.3s' }}
            >
              You answered{' '}
              {questions.filter((q, i) => answers[i] === q.correct).length} out
              of {questions.length} correctly.
            </p>
          </>
        ) : (
          <div className="rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-6">
            <div className="mb-2 text-4xl">💪</div>
            <h2 className="mb-2 text-xl font-bold text-atria-danger">
              You scored {result.score}%
            </h2>
            <p className="mb-4 text-sm text-atria-text-secondary">
              You need at least {passThreshold}% to pass. Review the material
              and try again.
            </p>
            <Button variant="secondary" size="lg" onClick={handleRetry}>
              Retake quiz
            </Button>
          </div>
        )}
      </div>
    )
  }

  const question = questions[currentQuestion]

  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-atria-surface-3">
          <div
            className="h-full rounded-full bg-atria-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {streak > 1 && (
          <div className="training-animate-streak-glow flex items-center gap-1 rounded-full bg-atria-warning/20 px-3 py-1">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold text-atria-warning">
              {streak}x streak!
            </span>
          </div>
        )}
      </div>
      <p className="mb-3 text-xs font-medium text-atria-text-muted">
        Question {currentQuestion + 1} of {total}
      </p>
      <div
        key={currentQuestion}
        className="training-animate-slide-in rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-5"
      >
        <p className="mb-4 text-sm font-semibold text-atria-ink">
          {question.question}
        </p>
        <div className="flex flex-col gap-2">
          {question.options.map((opt, oi) => {
            const isSelected = feedback?.index === oi
            const isCorrect = oi === question.correct
            const showResult = feedback !== null
            return (
              <button
                key={oi}
                type="button"
                disabled={showResult}
                onClick={() => handleAnswer(oi)}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-atria-md)] border p-3 text-left text-sm transition-all',
                  !showResult &&
                    answers[currentQuestion] === oi &&
                    'border-atria-accent bg-atria-accent-quiet text-atria-ink',
                  !showResult &&
                    answers[currentQuestion] !== oi &&
                    'border-atria-border bg-atria-surface text-atria-text-secondary hover:bg-atria-surface-3',
                  showResult &&
                    isCorrect &&
                    'border-atria-success bg-atria-success-bg text-atria-ink training-animate-pop',
                  showResult &&
                    isSelected &&
                    !isCorrect &&
                    'border-atria-danger bg-atria-danger-bg text-atria-ink training-animate-shake',
                  showResult &&
                    !isCorrect &&
                    !isSelected &&
                    'border-atria-border bg-atria-surface opacity-50',
                )}
              >
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                    !showResult &&
                      answers[currentQuestion] === oi &&
                      'border-atria-accent bg-atria-accent text-white',
                    !showResult &&
                      answers[currentQuestion] !== oi &&
                      'border-atria-border',
                    showResult && isCorrect &&
                      'border-atria-success bg-atria-success text-white',
                    showResult && isSelected && !isCorrect &&
                      'border-atria-danger bg-atria-danger text-white',
                    showResult && !isCorrect && !isSelected &&
                      'border-atria-border',
                  )}
                >
                  {showResult && isCorrect && '✓'}
                  {showResult && isSelected && !isCorrect && '✗'}
                  {!showResult && answers[currentQuestion] === oi && (
                    <svg
                      className="h-3 w-3 text-white"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </div>
                {opt}
              </button>
            )
          })}
        </div>
      </div>
      {feedback && (
        <div className="mt-3">
          {feedback.correct ? (
            <div className="training-animate-bounce-in flex items-center gap-2 rounded-[var(--radius-atria-md)] border border-atria-success/30 bg-atria-success-bg p-3">
              <span className="text-lg">🎉</span>
              <p className="text-sm font-medium text-atria-success">
                Correct! Great job!
              </p>
            </div>
          ) : (
            <div className="training-animate-bounce-in flex items-center gap-2 rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-3">
              <span className="text-lg">💦</span>
              <p className="text-sm font-medium text-atria-danger">
                Not quite. The correct answer is highlighted in green.
              </p>
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            className="mt-3 w-full"
            onClick={handleNext}
          >
            {currentQuestion < total - 1 ? 'Next question →' : 'See my score →'}
          </Button>
        </div>
      )}
    </div>
  )
}
