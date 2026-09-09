import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getDueCards, getDueCount, submitReview } from '../api/client'
import type { DueCount } from '../api/client'
import type { Card } from '../types'
import FlashCard from '../components/FlashCard'

type Deck = 'japanese' | 'english'

const NO_DUE: DueCount = { due: 0, pending: 0 }

/** "10 due", plus what the daily caps are holding back. */
function DueLabel({ count, theme }: { count: DueCount; theme: 'indigo' | 'emerald' }) {
  const held = count.pending - count.due
  return (
    <>
      <span
        className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
          count.due > 0
            ? theme === 'indigo'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {count.due > 0 ? `${count.due} due` : 'No cards due'}
      </span>
      {held > 0 && (
        <span className="text-[11px] text-gray-400">
          +{held} waiting for the coming days
        </span>
      )}
    </>
  )
}

function DeckPicker({ onPick }: { onPick: (deck: Deck) => void }) {
  const [jpDue, setJpDue] = useState<DueCount | null>(null)
  const [enDue, setEnDue] = useState<DueCount | null>(null)

  useEffect(() => {
    getDueCount('japanese').then((r) => setJpDue(r.data)).catch(() => setJpDue(NO_DUE))
    getDueCount('english').then((r) => setEnDue(r.data)).catch(() => setEnDue(NO_DUE))
  }, [])

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <h2 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent tracking-tight mb-2">
        Ready to study?
      </h2>
      <p className="text-gray-500 mb-12 text-base">Pick a deck to begin your review session.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          onClick={() => onPick('japanese')}
          className="group relative overflow-hidden bg-white border border-gray-100 hover:border-indigo-300 rounded-3xl px-8 py-10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-400 to-violet-500" />
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-indigo-50 opacity-60 group-hover:scale-125 transition-transform duration-500" />
          <div className="relative flex flex-col items-center gap-3">
            <span className="text-5xl">🇯🇵</span>
            <span className="text-xl font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">Japanese</span>
            <span className="text-xs text-gray-400">Kanji → meaning</span>
            {jpDue !== null && <DueLabel count={jpDue} theme="indigo" />}
          </div>
        </button>

        <button
          onClick={() => onPick('english')}
          className="group relative overflow-hidden bg-white border border-gray-100 hover:border-emerald-300 rounded-3xl px-8 py-10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-emerald-50 opacity-60 group-hover:scale-125 transition-transform duration-500" />
          <div className="relative flex flex-col items-center gap-3">
            <span className="text-5xl">🇬🇧</span>
            <span className="text-xl font-bold text-gray-800 group-hover:text-emerald-700 transition-colors">English</span>
            <span className="text-xs text-gray-400">Word → definition</span>
            {enDue !== null && <DueLabel count={enDue} theme="emerald" />}
          </div>
        </button>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-1.5 mt-12 text-sm text-gray-400 hover:text-gray-700 font-medium transition-colors"
      >
        ← Back to Cards
      </Link>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="max-w-lg mx-auto text-center py-24">
      <div className="inline-block w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-gray-400 mt-4 text-sm">Loading cards…</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="max-w-lg mx-auto text-center py-24">
      <p className="text-5xl mb-4">🔌</p>
      <p className="text-gray-600 font-medium mb-6">{message}</p>
      <button
        onClick={onRetry}
        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 font-semibold text-sm transition-all"
      >
        Try again
      </button>
    </div>
  )
}

function DoneState({
  reviewed,
  deck,
  onReset,
}: {
  reviewed: number
  deck: Deck
  onReset: () => void
}) {
  const themeText = deck === 'japanese' ? 'text-indigo-600' : 'text-emerald-600'
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-violet-500 to-emerald-400 rounded-full blur-2xl opacity-30 animate-pulse" />
        <div className="relative text-7xl">🎉</div>
      </div>
      <h2 className="text-3xl font-extrabold text-gray-800 mb-2 tracking-tight">All done!</h2>
      <p className="text-gray-500 mb-2">
        You reviewed{' '}
        <span className={`font-bold ${themeText}`}>
          {reviewed} card{reviewed !== 1 ? 's' : ''}
        </span>
      </p>
      <p className="text-xs text-gray-400 mb-10">Come back later for your next batch.</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onReset}
          className="bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl hover:border-gray-300 hover:bg-gray-50 font-semibold text-sm transition-all"
        >
          Switch deck
        </button>
        <Link
          to="/"
          className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:-translate-y-0.5 shadow-md shadow-indigo-200 font-semibold text-sm transition-all"
        >
          Back to Cards
        </Link>
      </div>
    </div>
  )
}

export default function Study() {
  // Deck and level live in the URL so other pages can deep-link into a
  // specific session — /study?deck=japanese&level=N1 skips the deck picker and
  // loads exactly the words the N1 page lists under "Today's new words".
  const [params, setParams] = useSearchParams()
  const deckParam = params.get('deck')
  const deck: Deck | null =
    deckParam === 'japanese' || deckParam === 'english' ? deckParam : null
  const level = params.get('level') || undefined

  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [reviewed, setReviewed] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    if (!deck) return
    setLoading(true)
    setError(null)
    setIndex(0)
    setReviewed(0)
    setDone(false)
    submitting.current = false
    getDueCards(deck, level)
      .then((r) => {
        setCards(r.data)
        if (r.data.length === 0) setDone(true)
      })
      .catch(() => setError('Could not load cards — is the backend running at localhost:8000?'))
      .finally(() => setLoading(false))
  }, [deck, level, reloadKey])

  async function handleQuality(quality: number) {
    // Bail if a grade is already in flight. This has to be a ref, not state:
    // two key events can fire in the same tick, before React re-renders, so
    // both would read the same `index` — grading one card twice while the next
    // one slides past unreviewed.
    if (submitting.current) return
    const card = cards[index]
    if (!card) return

    submitting.current = true
    try {
      await submitReview(card.id, quality)
      setReviewed((n) => n + 1)
      if (index + 1 >= cards.length) {
        setDone(true)
      } else {
        setIndex((i) => i + 1)
      }
    } catch {
      // Without this the rejection is unhandled and the session stalls on a
      // card with no explanation.
      setError('Could not save your review — is the backend running at localhost:8000?')
    } finally {
      submitting.current = false
    }
  }

  function pick(next: Deck) {
    setParams({ deck: next })
  }

  function reset() {
    setParams({})
    setCards([])
    setIndex(0)
    setReviewed(0)
    setDone(false)
    setError(null)
  }

  if (!deck) return <DeckPicker onPick={pick} />
  if (error) return <ErrorState message={error} onRetry={() => setReloadKey((n) => n + 1)} />
  if (loading || (!done && cards.length === 0)) return <LoadingState />
  if (done) return <DoneState reviewed={reviewed} deck={deck} onReset={reset} />

  const progress = ((index + 1) / cards.length) * 100
  const themeBar =
    deck === 'japanese'
      ? 'from-indigo-500 to-violet-500'
      : 'from-emerald-500 to-teal-500'

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress header */}
      <div className="flex items-center gap-3 mb-8">
        {level && (
          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full shrink-0">
            {level}
          </span>
        )}
        <span className="text-xs font-bold tabular-nums text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
          {index + 1} / {cards.length}
        </span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${themeBar} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          onClick={reset}
          className="text-xs font-semibold text-gray-400 hover:text-gray-700 px-2.5 py-1 rounded-full hover:bg-gray-100 transition-colors shrink-0"
        >
          Exit
        </button>
      </div>

      <FlashCard key={cards[index].id} card={cards[index]} onQuality={handleQuality} />
    </div>
  )
}
