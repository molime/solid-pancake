import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { Volume2, VolumeX, Pause, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { TrainingSlide } from '../model/courseTypes'

interface SlideDeckProps {
  slides: TrainingSlide[]
  onAllViewed: () => void
}

function useSpeechSynthesis() {
  const synthRef = useRef<SpeechSynthesis | null>(
    typeof window !== 'undefined' ? window.speechSynthesis : null,
  )
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const synth = synthRef.current
    if (!synth) return
    // Some browsers load voices asynchronously.
    const checkVoices = () => {
      setAvailable(synth.getVoices().length > 0)
    }
    checkVoices()
    synth.addEventListener?.('voiceschanged', checkVoices)
    return () => {
      synth.removeEventListener?.('voiceschanged', checkVoices)
    }
  }, [])

  const stop = useCallback(() => {
    const synth = synthRef.current
    if (!synth) return
    synth.cancel()
    utteranceRef.current = null
    setSpeaking(false)
  }, [])

  const pickBestVoice = useCallback((voices: SpeechSynthesisVoice[]) => {
    // Prefer modern "natural"/neural voices first — they sound like a real
    // instructor rather than a robotic reader. Edge/Chrome expose these as
    // online voices (localService=false), so do not require localService here.
    const preferredNames = [
      'Microsoft Aria',
      'Microsoft Jenny',
      'Microsoft Natasha',
      'Microsoft Sonia',
      'Microsoft Libby',
      'Microsoft Ana',
      'Microsoft Guy',
      'Google US English',
      'Samantha',
      'Ava',
      'Allison',
      'Vicki',
      'Victoria',
      'Karen',
      'Daniel',
      'Alex',
      'Tessa',
      'Moira',
      'Fiona',
      'Microsoft Zira',
      'Microsoft Eva',
      'Microsoft David',
      'Microsoft Mark',
      'Apple Samantha',
    ]
    for (const name of preferredNames) {
      const match = voices.find(
        (v) =>
          v.name.includes(name) &&
          typeof v.lang === 'string' &&
          v.lang.startsWith('en'),
      )
      if (match) return match
    }
    return (
      voices.find((v) => v.lang === 'en-US') ??
      voices.find((v) => typeof v.lang === 'string' && v.lang.startsWith('en')) ??
      voices[0]
    )
  }, [])

  const speak = useCallback(
    (text: string) => {
      const synth = synthRef.current
      if (!synth || !text.trim()) return
      stop()
      const utterance = new SpeechSynthesisUtterance(text)
      const voices = synth.getVoices()
      const voice = pickBestVoice(voices)
      if (voice) utterance.voice = voice
      // Slightly slower, warm pitch for a more natural training voice.
      utterance.rate = 0.88
      utterance.pitch = 1.02
      utterance.onend = () => {
        setSpeaking(false)
        utteranceRef.current = null
      }
      utterance.onerror = () => {
        setSpeaking(false)
        utteranceRef.current = null
      }
      utteranceRef.current = utterance
      setSpeaking(true)
      synth.speak(utterance)
    },
    [stop, pickBestVoice],
  )

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { available, speaking, speak, stop }
}

export function SlideDeck({ slides, onAllViewed }: SlideDeckProps) {
  const [current, setCurrent] = useState(0)
  const [viewed, setViewed] = useState<Set<number>>(new Set([0]))
  const { available, speaking, speak, stop } = useSpeechSynthesis()
  const slide = slides[current]
  const isFirst = current === 0
  const isLast = current === slides.length - 1
  const allViewed = viewed.size === slides.length

  useEffect(() => {
    if (allViewed) {
      onAllViewed()
    }
  }, [allViewed, onAllViewed])

  useEffect(() => {
    // Stop narration when the slide changes.
    stop()
  }, [current, stop])

  const goTo = (index: number) => {
    if (index < 0 || index >= slides.length) return
    setCurrent(index)
    setViewed((prev) => new Set([...prev, index]))
  }

  const handleNext = () => goTo(current + 1)
  const handlePrev = () => goTo(current - 1)

  const toggleNarration = () => {
    if (speaking) {
      stop()
    } else if (slide.narration || slide.body) {
      speak(slide.narration || slide.body)
    }
  }

  return (
    <div className="training-animate-fade-up mb-6 overflow-hidden rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface">
      <div className="relative aspect-video w-full bg-atria-surface-2">
        {slide.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt={slide.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-atria-accent/10 to-atria-info/10">
            <span className="text-6xl">📚</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-sm font-medium text-white/90">
            Slide {current + 1} of {slides.length}
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold text-atria-ink">{slide.title}</h3>
          {available && (
            <button
              type="button"
              onClick={toggleNarration}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                speaking
                  ? 'bg-atria-accent text-white'
                  : 'bg-atria-surface-2 text-atria-text-secondary hover:bg-atria-surface-3 hover:text-atria-ink',
              )}
              aria-label={speaking ? 'Stop narration' : 'Read slide aloud'}
            >
              {speaking ? (
                <>
                  <Pause className="h-4 w-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  <span>Listen</span>
                </>
              )}
            </button>
          )}
          {!available && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-atria-text-muted">
              <VolumeX className="h-4 w-4" />
              Audio unavailable
            </span>
          )}
        </div>

        <div className="prose prose-invert max-w-none">
          {slide.body.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="text-base leading-relaxed text-atria-text-secondary">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePrev}
            disabled={isFirst}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <div className="flex flex-1 justify-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goTo(idx)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  idx === current
                    ? 'w-6 bg-atria-accent'
                    : viewed.has(idx)
                      ? 'w-2 bg-atria-text-muted/60'
                      : 'w-2 bg-atria-surface-3',
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleNext}
            disabled={isLast}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {allViewed && (
        <div className="training-animate-bounce-in border-t border-atria-border bg-atria-success-bg p-4">
          <div className="flex items-center gap-2 text-atria-success">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-sm font-medium">
              All slides viewed. Mark the section as read below to continue.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
