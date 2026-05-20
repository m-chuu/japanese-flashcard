import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDueCards, submitReview } from '../api/client'
import type { Card } from '../types'
import FlashCard from '../components/FlashCard'

type Deck = 'japanese' | 'english'

function DeckPicker({ onPick }: { onPick: (deck: Deck) => void }) {
  const [jpDue, setJpDue] = useState<number | null>(null)
  const [enDue, setEnDue] = useState<number | null>(null)

  useEffect(() => {
    getDueCards('japanese').then((r) => setJpDue(r.data.length)).catch(() => setJpDue(0))
    getDueCards('english').then((r) => setEnDue(r.data.length)).catch(() => setEnDue(0))
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
            {jpDue !== null && (
              <span
                className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
                  jpDue > 0
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {jpDue > 0 ? `${jpDue} due` : 'No cards due'}
              </span>
            )}
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
            {enDue !== null && (
              <span
                className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
                  enDue > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {enDue > 0 ? `${enDue} due` : 'No cards due'}
              </span>
            )}
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
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [reviewed, setReviewed] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!deck) return
    setLoading(true)
    getDueCards(deck).then((r) => {
      setCards(r.data)
      setLoading(false)
      if (r.data.length === 0) setDone(true)
    })
  }, [deck])

  async function handleQuality(quality: number) {
    await submitReview(cards[index].id, quality)
    setReviewed((n) => n + 1)
    if (index + 1 >= cards.length) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  function reset() {
    setDeck(null)
    setCards([])
    setIndex(0)
    setReviewed(0)
    setDone(false)
  }

  if (!deck) return <DeckPicker onPick={setDeck} />
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
