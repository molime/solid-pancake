import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlideDeck } from './SlideDeck'
import type { TrainingSlide } from '../model/courseTypes'

const slides: TrainingSlide[] = [
  {
    id: 's1',
    title: 'First Slide',
    body: 'Body of the first slide.',
    imageUrl: 'https://example.com/1.jpg',
    narration: 'Narration one.',
  },
  {
    id: 's2',
    title: 'Second Slide',
    body: 'Body of the second slide.',
  },
  {
    id: 's3',
    title: 'Third Slide',
    body: 'Body of the third slide.',
    narration: 'Narration three.',
  },
]

class MockUtterance {
  text = ''
  rate = 1
  pitch = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

const mockSynth = {
  getVoices: vi.fn().mockReturnValue([{ name: 'English' }] as unknown as SpeechSynthesisVoice[]),
  speak: vi.fn(),
  cancel: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as SpeechSynthesis

describe('SlideDeck', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSynth,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the first slide and progress indicator', () => {
    render(<SlideDeck slides={slides} onAllViewed={vi.fn()} />)

    expect(screen.getByText('First Slide')).toBeInTheDocument()
    expect(screen.getByText('Body of the first slide.')).toBeInTheDocument()
    expect(screen.getByText('Slide 1 of 3')).toBeInTheDocument()
  })

  it('navigates forward and calls onAllViewed when every slide is viewed', async () => {
    const onAllViewed = vi.fn()
    const user = userEvent.setup()
    render(<SlideDeck slides={slides} onAllViewed={onAllViewed} />)

    await user.click(screen.getByRole('button', { name: /Next/i }))
    expect(screen.getByText('Second Slide')).toBeInTheDocument()
    expect(screen.getByText('Slide 2 of 3')).toBeInTheDocument()
    expect(onAllViewed).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Next/i }))
    expect(screen.getByText('Third Slide')).toBeInTheDocument()
    expect(screen.getByText('Slide 3 of 3')).toBeInTheDocument()
    expect(onAllViewed).toHaveBeenCalledTimes(1)
  })

  it('navigates backward and enables the Previous button only after moving forward', async () => {
    const user = userEvent.setup()
    render(<SlideDeck slides={slides} onAllViewed={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Previous/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Next/i }))
    expect(screen.getByRole('button', { name: /Previous/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /Previous/i }))
    expect(screen.getByText('First Slide')).toBeInTheDocument()
  })

  it('supports dot navigation and tracks progress per viewed slide', async () => {
    const onAllViewed = vi.fn()
    const user = userEvent.setup()
    render(<SlideDeck slides={slides} onAllViewed={onAllViewed} />)

    // Jumping directly to the last slide does not mark earlier slides as viewed.
    await user.click(screen.getByRole('button', { name: /Go to slide 3/i }))
    expect(screen.getByText('Third Slide')).toBeInTheDocument()
    expect(onAllViewed).not.toHaveBeenCalled()

    // View the remaining slides through dot navigation to complete the deck.
    await user.click(screen.getByRole('button', { name: /Go to slide 2/i }))
    await user.click(screen.getByRole('button', { name: /Go to slide 1/i }))
    await waitFor(() => expect(onAllViewed).toHaveBeenCalledTimes(1))
  })

  it('plays and stops narration when the Listen button is toggled', async () => {
    const user = userEvent.setup()
    render(<SlideDeck slides={slides} onAllViewed={vi.fn()} />)

    const listenButton = screen.getByRole('button', { name: /Read slide aloud/i })
    await user.click(listenButton)
    expect(mockSynth.speak).toHaveBeenCalledTimes(1)

    const stopButton = await screen.findByRole('button', { name: /Stop narration/i })
    await user.click(stopButton)
    expect(mockSynth.cancel).toHaveBeenCalled()
  })

  it('falls back to body text when narration is not provided', async () => {
    const user = userEvent.setup()
    render(<SlideDeck slides={slides} onAllViewed={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Next/i }))
    await user.click(screen.getByRole('button', { name: /Read slide aloud/i }))

    const spoken = (mockSynth.speak as ReturnType<typeof vi.fn>).mock.calls[0][0] as MockUtterance
    expect(spoken.text).toBe('Body of the second slide.')
  })

  it('shows an unavailable audio state when the browser has no speech synthesis', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: null,
      writable: true,
      configurable: true,
    })

    render(<SlideDeck slides={slides} onAllViewed={vi.fn()} />)
    expect(screen.getByText('Audio unavailable')).toBeInTheDocument()
  })
})
