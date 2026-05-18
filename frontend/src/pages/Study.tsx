import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDueCards, submitReview } from '../api/client'
import type { Card } from '../types'
import FlashCard from '../components/FlashCard'

type Deck = 'japanese' | 'english'

function DeckPicker({ onPick }: { onPick: (deck: Deck) => void }) {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Choose a deck</h2>
      <p className="text-gray-400 mb-10 text-sm">Which flashcards do you want to study?</p>
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => onPick('japanese')}
          className="flex flex-col items-center gap-3 bg-white border-2 border-indigo-200 hover:border-indigo-500 rounded-2xl px-10 py-8 shadow-sm transition-colors group"
        >
          <span className="text-4xl">🇯🇵</span>
          <span className="text-lg font-semibold text-indigo-700 group-hover:text-indigo-900">Japanese</span>
          <span className="text-xs text-gray-400">Kanji + meaning</span>
        </button>
        <button
          onClick={() => onPick('english')}
          className="flex flex-col items-center gap-3 bg-white border-2 border-emerald-200 hover:border-emerald-500 rounded-2xl px-10 py-8 shadow-sm transition-colors group"
        >
          <span className="text-4xl">🇬🇧</span>
          <span className="text-lg font-semibold text-emerald-700 group-hover:text-emerald-900">English</span>
          <span className="text-xs text-gray-400">Word + definition</span>
        </button>
      </div>
      <Link to="/" className="inline-block mt-10 text-sm text-gray-400 hover:text-gray-600">
        ← Back to Cards
      </Link>
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

  if (!deck) return <DeckPicker onPick={setDeck} />

  if (loading || (!done && cards.length === 0)) {
    return <p className="text-center text-gray-400 py-16">Loading…</p>
  }

  if (done) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">All done!</h2>
        <p className="text-gray-500 mb-8">
          You reviewed {reviewed} card{reviewed !== 1 ? 's' : ''}.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setDeck(null); setCards([]); setIndex(0); setReviewed(0); setDone(false) }}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200"
          >
            Switch deck
          </button>
          <Link
            to="/"
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Back to Cards
          </Link>
        </div>
      </div>
    )
  }

  const progress = (index / cards.length) * 100

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-8">
        <span className="text-sm text-gray-400 shrink-0">
          {index + 1} / {cards.length}
        </span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-2 bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          onClick={() => { setDeck(null); setCards([]); setIndex(0); setReviewed(0); setDone(false) }}
          className="text-sm text-gray-400 hover:text-gray-600 shrink-0"
        >
          Exit
        </button>
      </div>

      <FlashCard key={cards[index].id} card={cards[index]} onQuality={handleQuality} />
    </div>
  )
}
