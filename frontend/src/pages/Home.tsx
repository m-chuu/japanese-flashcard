import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCards, deleteCard, getDueCards, getStats } from '../api/client'
import type { Stats } from '../api/client'
import type { Card } from '../types'
import { JLPT_LEVELS } from '../types'

type DeckTab = 'japanese' | 'english'

const jlptColor: Record<string, string> = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-amber-100 text-amber-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
  Unknown: 'bg-gray-100 text-gray-500',
}

const jlptGradient: Record<string, string> = {
  N5: 'from-emerald-400 to-green-500',
  N4: 'from-blue-400 to-indigo-500',
  N3: 'from-amber-400 to-yellow-500',
  N2: 'from-orange-400 to-amber-500',
  N1: 'from-red-400 to-rose-500',
  Unknown: 'from-gray-300 to-slate-400',
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
      <div className="p-5 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-12 w-28 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string
  label: string
  value: number | string
  highlight?: boolean
}) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-2xl py-5 px-3 gap-1.5 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 ${
        highlight
          ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200'
          : 'bg-white border border-gray-100 shadow-sm hover:shadow-md'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span
        className={`text-3xl font-bold tabular-nums leading-none ${
          highlight ? 'text-white' : 'text-gray-800'
        }`}
      >
        {value}
      </span>
      <span className={`text-xs font-medium ${highlight ? 'text-indigo-100' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

export default function Home() {
  const [deck, setDeck] = useState<DeckTab>('japanese')
  const [cards, setCards] = useState<Card[]>([])
  const [jpDue, setJpDue] = useState(0)
  const [enDue, setEnDue] = useState(0)
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    getStats().then((r) => setStats(r.data)).catch(() => {})
    getDueCards('japanese').then((r) => setJpDue(r.data.length))
    getDueCards('english').then((r) => setEnDue(r.data.length))
  }, [])

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

  const totalDue = jpDue + enDue

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard icon="🔥" label="Day Streak" value={stats.streak} highlight={stats.streak > 0} />
          <StatCard icon="📚" label="Due Today" value={stats.due_today} highlight={stats.due_today > 0} />
          <StatCard icon="✅" label="Mastered" value={stats.mastered} />
          <StatCard icon="🗂" label="Total Cards" value={stats.total_cards} />
        </div>
      )}

      {/* Due-cards banner */}
      {totalDue > 0 && (
        <div className="mb-5 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl px-5 py-3.5 gap-4 flex-wrap shadow-sm">
          <div className="flex gap-4 text-sm">
            {jpDue > 0 && (
              <span className="text-indigo-700 font-semibold flex items-center gap-1.5">
                🇯🇵 {jpDue} JP due
              </span>
            )}
            {enDue > 0 && (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                🇬🇧 {enDue} EN due
              </span>
            )}
          </div>
          <Link
            to="/study"
            className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 font-semibold hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            Study Now →
          </Link>
        </div>
      )}

      {/* Deck tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setDeck('japanese')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
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
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
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

      {/* JLPT filter pills */}
      {deck === 'japanese' && (
        <div className="flex gap-2 flex-wrap mb-6">
          {['All', ...JLPT_LEVELS].map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                filter === level
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🗃️</p>
          <p className="text-gray-500 mb-6 text-lg font-medium">No {deck} cards yet</p>
          <Link
            to={deck === 'japanese' ? '/add' : '/add-english'}
            className={`inline-block px-8 py-3 rounded-xl text-white font-semibold shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg ${
              deck === 'japanese'
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
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
  const gradient = jlptGradient[card.jlpt_level] ?? jlptGradient.Unknown
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />
      <div className="p-5 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              jlptColor[card.jlpt_level] ?? jlptColor.Unknown
            }`}
          >
            {card.jlpt_level}
          </span>
          <CardActions id={card.id} onDelete={onDelete} />
        </div>
        <p className="text-5xl font-bold text-gray-900 leading-tight mt-1">{card.japanese}</p>
        {card.furigana && (
          <p className="text-sm font-medium text-indigo-500">{card.furigana}</p>
        )}
        <p className="text-gray-500 text-sm leading-relaxed">{card.english}</p>
        {card.synonym && <p className="text-xs text-gray-400">≈ {card.synonym}</p>}
      </div>
    </div>
  )
}

function EnglishCardTile({ card, onDelete }: { card: Card; onDelete: (id: number) => void }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
      <div className="p-5 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700">
            {card.jlpt_level !== 'Unknown' ? card.jlpt_level : 'EN'}
          </span>
          <CardActions id={card.id} onDelete={onDelete} />
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-tight mt-1">{card.japanese}</p>
        {card.furigana && <p className="text-sm text-gray-400">{card.furigana}</p>}
        <p className="text-gray-500 text-sm leading-relaxed">{card.english}</p>
        {card.synonym && <p className="text-xs text-gray-400">≈ {card.synonym}</p>}
      </div>
    </div>
  )
}

function CardActions({ id, onDelete }: { id: number; onDelete: (id: number) => void }) {
  return (
    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <Link
        to={`/edit/${id}`}
        className="text-xs text-gray-400 hover:text-indigo-600 font-medium transition-colors"
      >
        Edit
      </Link>
      <button
        onClick={() => onDelete(id)}
        className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors"
      >
        Delete
      </button>
    </div>
  )
}
