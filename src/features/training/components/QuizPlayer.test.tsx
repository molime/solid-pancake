import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuizPlayer } from './QuizPlayer'

const QUESTION = {
  question: 'Pick the right letter',
  options: ['A', 'B', 'C', 'D'],
  correct: 1,
}

describe('QuizPlayer answer randomization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the original order when the shuffle is identity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999)
    render(
      <QuizPlayer
        questions={[QUESTION]}
        passThreshold={100}
        onComplete={vi.fn()}
      />,
    )

    const buttons = screen.getAllByRole('button', { name: /^[ABCD]$/ })
    expect(buttons.map((b) => b.textContent)).toEqual(['A', 'B', 'C', 'D'])

    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(screen.getByText(/Correct! Great job!/)).toBeInTheDocument()
  })

  it('shuffles options and still scores the remapped correct answer', () => {
    // Math.random() === 0 forces a deterministic permutation: with the
    // Fisher-Yates loop this yields options [B, C, D, A] and correct index 0.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(
      <QuizPlayer
        questions={[QUESTION]}
        passThreshold={100}
        onComplete={vi.fn()}
      />,
    )

    const buttons = screen.getAllByRole('button', { name: /^[ABCD]$/ })
    expect(buttons.map((b) => b.textContent)).toEqual(['B', 'C', 'D', 'A'])

    // The original correct answer ('B') must still score as correct at its
    // new shuffled position.
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(screen.getByText(/Correct! Great job!/)).toBeInTheDocument()
  })
})
