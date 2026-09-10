import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCard } from '../api/client'
import type { Card } from '../types'
import AddCard from './AddCard'
import AddEnglishCard from './AddEnglishCard'

/**
 * /edit/:id — loads the card, then hands it to the form that matches its deck.
 *
 * Deciding here rather than at the link means a bookmarked or hand-typed edit
 * URL opens the right form too, and the card is fetched once and passed down
 * instead of each form fetching it again.
 */
export default function EditCard() {
  const { id } = useParams()
  const [card, setCard] = useState<Card | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCard(null)
    setError(null)
    getCard(Number(id))
      .then((res) => {
        if (!cancelled) setCard(res.data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load that card.')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-5xl mb-4">🔍</p>
        <p className="text-gray-600 font-medium mb-6">{error}</p>
        <Link
          to="/"
          className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 font-semibold text-sm"
        >
          Back to Cards
        </Link>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center text-gray-400 text-sm animate-pulse">
        Loading card…
      </div>
    )
  }

  return card.card_type === 'english' ? (
    <AddEnglishCard card={card} />
  ) : (
    <AddCard card={card} />
  )
}
