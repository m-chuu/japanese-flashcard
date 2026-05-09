import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCards, deleteCard, getDueCards } from '../api/client'
import type { Card } from '../types'
import { JLPT_LEVELS } from '../types'

const jlptColor: Record<string, string> = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-yellow-100 text-yellow-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
  Unknown: 'bg-gray-100 text-gray-500',
}

export default function Home() {
  const [cards, setCards] = useState<Card[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCards()
  }, [filter])

  useEffect(() => {
    getDueCards().then((r) => setDueCount(r.data.length))
  }, [])

  async function loadCards() {
    setLoading(true)
    const res = await getCards(filter === 'All' ? undefined : filter)
    setCards(res.data)
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this card?')) return
    await deleteCard(id)
    setCards((prev) => prev.filter((c) => c.id !== id))
    setDueCount((n) => Math.max(0, n - 1))
  }

  return (
    <div>
      {/* Due-cards banner */}
      {dueCount > 0 && (
        <div className="mb-6 flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3">
          <span className="text-indigo-700 font-medium text-sm">
            {dueCount} card{dueCount !== 1 ? 's' : ''} due for review
          </span>
          <Link
            to="/study"
            className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Study Now →
          </Link>
        </div>
      )}

      {/* JLPT filter pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {['All', ...JLPT_LEVELS].map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === level
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Card grid */}
      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No cards yet.</p>
          <Link
            to="/add"
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Add your first card
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2"
            >
              <div className="flex justify-between items-start">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    jlptColor[card.jlpt_level] ?? jlptColor.Unknown
                  }`}
                >
                  {card.jlpt_level}
                </span>
                <div className="flex gap-3">
                  <Link
                    to={`/edit/${card.id}`}
                    className="text-xs text-gray-400 hover:text-indigo-600"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="text-4xl font-bold text-gray-900 leading-tight">{card.japanese}</p>
              {card.furigana && (
                <p className="text-sm text-indigo-500">{card.furigana}</p>
              )}
              <p className="text-gray-600 text-sm">{card.english}</p>
              {card.synonym && (
                <p className="text-xs text-gray-400">≈ {card.synonym}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
