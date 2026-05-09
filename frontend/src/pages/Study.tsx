import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDueCards, submitReview } from '../api/client'
import type { Card } from '../types'
import FlashCard from '../components/FlashCard'

export default function Study() {
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const [reviewed, setReviewed] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDueCards().then((r) => {
      setCards(r.data)
      setLoading(false)
      if (r.data.length === 0) setDone(true)
    })
  }, [])

  async function handleQuality(quality: number) {
    await submitReview(cards[index].id, quality)
    setReviewed((n) => n + 1)
    if (index + 1 >= cards.length) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (loading) {
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
        <Link
          to="/"
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          Back to Cards
        </Link>
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
        <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 shrink-0">
          Exit
        </Link>
      </div>

      <FlashCard card={cards[index]} onQuality={handleQuality} />
    </div>
  )
}
