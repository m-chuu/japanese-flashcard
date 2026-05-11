import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCards, deleteCard, getDueCards } from '../api/client'
import type { Card } from '../types'
import { JLPT_LEVELS } from '../types'

type DeckTab = 'japanese' | 'english'

const jlptColor: Record<string, string> = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-yellow-100 text-yellow-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
  Unknown: 'bg-gray-100 text-gray-500',
}

export default function Home() {
  const [deck, setDeck] = useState<DeckTab>('japanese')
  const [cards, setCards] = useState<Card[]>([])
  const [jpDue, setJpDue] = useState(0)
  const [enDue, setEnDue] = useState(0)
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  // Fetch due counts for both decks once on mount
  useEffect(() => {
    getDueCards('japanese').then((r) => setJpDue(r.data.length))
    getDueCards('english').then((r) => setEnDue(r.data.length))
  }, [])

  // Reload cards when deck or filter changes
  useEffect(() => {
    setFilter('All')
  }, [deck])

  useEffect(() => {
    loadCards()
  }, [deck, filter])

  async function loadCards() {
    setLoading(true)
    try {
      const jlptFilter = deck === 'japanese' && filter !== 'All' ? filter : undefined
      const res = await getCards(jlptFilter, deck)
      setCards(res.data)
    } catch (err) {
      console.error('Failed to load cards:', err)
      setCards([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this card?')) return
    await deleteCard(id)
    setCards((prev) => prev.filter((c) => c.id !== id))
    if (deck === 'japanese') setJpDue((n) => Math.max(0, n - 1))
    else setEnDue((n) => Math.max(0, n - 1))
  }

  const dueCount = deck === 'japanese' ? jpDue : enDue
  const totalDue = jpDue + enDue

  return (
    <div>
      {/* Due-cards banner */}
      {totalDue > 0 && (
        <div className="mb-5 flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 gap-4 flex-wrap">
          <div className="flex gap-4 text-sm">
            {jpDue > 0 && (
              <span className="text-indigo-700 font-medium">
                🇯🇵 {jpDue} JP due
              </span>
            )}
            {enDue > 0 && (
              <span className="text-emerald-700 font-medium">
                🇬🇧 {enDue} EN due
              </span>
            )}
          </div>
          <Link
            to="/study"
            className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            Study Now →
          </Link>
        </div>
      )}

      {/* Deck tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setDeck('japanese')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            deck === 'japanese'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🇯🇵 Japanese
          {jpDue > 0 && (
            <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
              {jpDue}
            </span>
          )}
        </button>
        <button
          onClick={() => setDeck('english')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            deck === 'english'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🇬🇧 English
          {enDue > 0 && (
            <span className="ml-2 text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">
              {enDue}
            </span>
          )}
        </button>
      </div>

      {/* JLPT filter pills — Japanese only */}
      {deck === 'japanese' && (
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
      )}

      {/* Card grid */}
      {loading ? (
        <p className="text-center text-gray-400 py-16">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No {deck} cards yet.</p>
          <Link
            to={deck === 'japanese' ? '/add' : '/add-english'}
            className={`px-6 py-2 rounded-lg text-white ${
              deck === 'japanese' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            Add your first {deck === 'japanese' ? 'Japanese' : 'English'} card
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) =>
            deck === 'japanese' ? (
              <JapaneseCardTile key={card.id} card={card} onDelete={handleDelete} />
            ) : (
              <EnglishCardTile key={card.id} card={card} onDelete={handleDelete} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function JapaneseCardTile({ card, onDelete }: { card: Card; onDelete: (id: number) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jlptColor[card.jlpt_level] ?? jlptColor.Unknown}`}>
          {card.jlpt_level}
        </span>
        <CardActions id={card.id} onDelete={onDelete} />
      </div>
      <p className="text-4xl font-bold text-gray-900 leading-tight">{card.japanese}</p>
      {card.furigana && <p className="text-sm text-indigo-500">{card.furigana}</p>}
      <p className="text-gray-600 text-sm">{card.english}</p>
      {card.synonym && <p className="text-xs text-gray-400">≈ {card.synonym}</p>}
    </div>
  )
}

function EnglishCardTile({ card, onDelete }: { card: Card; onDelete: (id: number) => void }) {
  return (
    <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
          {card.jlpt_level !== 'Unknown' ? card.jlpt_level : 'EN'}
        </span>
        <CardActions id={card.id} onDelete={onDelete} />
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{card.japanese}</p>
      {card.furigana && <p className="text-sm text-gray-400">{card.furigana}</p>}
      <p className="text-gray-600 text-sm">{card.english}</p>
      {card.synonym && <p className="text-xs text-gray-400">≈ {card.synonym}</p>}
    </div>
  )
}

function CardActions({ id, onDelete }: { id: number; onDelete: (id: number) => void }) {
  return (
    <div className="flex gap-3">
      <Link to={`/edit/${id}`} className="text-xs text-gray-400 hover:text-indigo-600">
        Edit
      </Link>
      <button onClick={() => onDelete(id)} className="text-xs text-gray-400 hover:text-red-500">
        Delete
      </button>
    </div>
  )
}
