import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getLearnedSummary, getLearnedWords, unmarkLearned } from '../api/client'
import type { LearnedSummary } from '../api/client'
import type { Card } from '../types'

const jlptColor: Record<string, string> = {
  N5: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  N4: 'bg-blue-100 text-blue-700 border-blue-200',
  N3: 'bg-amber-100 text-amber-700 border-amber-200',
  N2: 'bg-orange-100 text-orange-700 border-orange-200',
  N1: 'bg-red-100 text-red-700 border-red-200',
  Unknown: 'bg-gray-100 text-gray-500 border-gray-200',
}

const jlptGradient: Record<string, string> = {
  N5: 'from-emerald-400 to-green-500',
  N4: 'from-blue-400 to-indigo-500',
  N3: 'from-amber-400 to-yellow-500',
  N2: 'from-orange-400 to-amber-500',
  N1: 'from-red-400 to-rose-500',
  Unknown: 'from-gray-300 to-slate-400',
}

type Tab = 'japanese' | 'english'
type Sort = 'recent' | 'alpha'

function matchesQuery(c: Card, q: string): boolean {
  if (!q) return true
  const s = q.toLowerCase()
  return (
    c.japanese?.toLowerCase().includes(s) ||
    c.furigana?.toLowerCase().includes(s) ||
    c.english?.toLowerCase().includes(s)
  )
}

function sortWords(arr: Card[], sort: Sort): Card[] {
  if (sort === 'alpha') {
    return [...arr].sort((a, b) =>
      (a.japanese || a.english || '').localeCompare(b.japanese || b.english || '', 'ja'),
    )
  }
  // 'recent' — preserve backend order (last_reviewed desc)
  return arr
}

export default function Learned() {
  const [tab, setTab] = useState<Tab>('japanese')

  // All learned words are loaded up front (the daily cap keeps these lists
  // small) so search/sort can work across levels from a single source.
  const [jpSummary, setJpSummary] = useState<LearnedSummary | null>(null)
  const [jpWords, setJpWords] = useState<Card[] | null>(null)
  const [enWords, setEnWords] = useState<Card[] | null>(null)

  const [openLevel, setOpenLevel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')

  // Unmark uses a deferred commit: remove from the UI immediately, then fire
  // the backend call ~5s later. An "Undo" in that window cancels the call so
  // the card's review progress is never reset.
  const [pending, setPending] = useState<{ card: Card; index: number } | null>(null)
  const commitTimer = useRef<number | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [jpSum, jp, en] = await Promise.all([
        getLearnedSummary('japanese'),
        getLearnedWords(undefined, 'japanese'),
        getLearnedWords(undefined, 'english'),
      ])
      setJpSummary(jpSum.data)
      setJpWords(jp.data)
      setEnWords(en.data)
    } finally {
      setLoading(false)
    }
  }

  function flushPending() {
    if (commitTimer.current !== null) {
      clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
    if (pending) {
      unmarkLearned(pending.card.id).catch(() => {})
      setPending(null)
    }
  }

  function requestUnmark(card: Card) {
    // Commit any in-flight removal before starting a new one.
    flushPending()

    const isEn = card.card_type === 'english'
    const arr = isEn ? enWords : jpWords
    const index = arr ? arr.findIndex((c) => c.id === card.id) : -1

    if (isEn) {
      setEnWords((prev) => (prev ? prev.filter((c) => c.id !== card.id) : prev))
    } else {
      setJpWords((prev) => (prev ? prev.filter((c) => c.id !== card.id) : prev))
    }

    setPending({ card, index: index < 0 ? 0 : index })
    commitTimer.current = window.setTimeout(() => {
      unmarkLearned(card.id).catch(() => {})
      commitTimer.current = null
      setPending(null)
    }, 5000)
  }

  function undoUnmark() {
    if (!pending) return
    if (commitTimer.current !== null) {
      clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
    const { card, index } = pending
    const insert = (prev: Card[] | null): Card[] => {
      const list = prev ? [...prev] : []
      list.splice(Math.min(index, list.length), 0, card)
      return list
    }
    if (card.card_type === 'english') setEnWords(insert)
    else setJpWords(insert)
    setPending(null)
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-16">Loading…</p>
  }

  const jpTotal = jpWords?.length ?? 0
  const enCount = enWords?.length ?? 0
  const totalAll = jpTotal + enCount

  if (totalAll === 0 && !pending) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">📖</p>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No learned words yet</h2>
        <p className="text-gray-500 mb-8">Words you've studied will show up here.</p>
        <Link
          to="/study"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-semibold shadow-md shadow-indigo-200"
        >
          Start studying →
        </Link>
      </div>
    )
  }

  const headerCount = tab === 'japanese' ? jpTotal : enCount
  const headerLabel = tab === 'japanese' ? 'Japanese Words Learned' : 'English Words Learned'
  const q = query.trim().toLowerCase()

  function renderWordList(words: Card[], emptyMsg: string) {
    if (words.length === 0) {
      return <p className="text-center text-gray-400 py-8 text-sm">{emptyMsg}</p>
    }
    return (
      <ul className="divide-y divide-gray-100">
        {words.map((c) => {
          const isEn = c.card_type === 'english'
          return (
          <li
            key={c.id}
            className="px-5 py-3 flex items-start gap-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-gray-900 break-words">
                {c.japanese}
                {c.furigana && (
                  <span
                    className={`ml-2 text-sm font-medium ${
                      isEn ? 'text-gray-400 font-mono' : 'text-indigo-500'
                    }`}
                  >
                    {c.furigana}
                  </span>
                )}
                {isEn && c.jlpt_level && c.jlpt_level !== 'Unknown' && (
                  <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                    {c.jlpt_level}
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-600 break-words">{c.english}</p>
              {c.note && (
                <p className="mt-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words">
                  📝 {c.note}
                </p>
              )}
            </div>
            <button
              onClick={() => requestUnmark(c)}
              aria-label="Unmark as learned"
              className="text-xs text-gray-400 hover:text-red-500 font-medium shrink-0 mt-0.5 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
            >
              Unmark
            </button>
          </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">
          {headerLabel}
        </p>
        <p className="text-6xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tabular-nums">
          {headerCount}
        </p>
      </div>

      <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('japanese')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            tab === 'japanese'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🇯🇵 Japanese
          <span className="ml-2 text-xs text-gray-400 tabular-nums">{jpTotal}</span>
        </button>
        <button
          onClick={() => setTab('english')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            tab === 'english'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🇬🇧 English
          <span className="ml-2 text-xs text-gray-400 tabular-nums">{enCount}</span>
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search learned words…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
          />
        </div>
        <div
          className="flex shrink-0 bg-gray-100 rounded-xl p-1"
          role="group"
          aria-label="Sort order"
        >
          <button
            onClick={() => setSort('recent')}
            aria-pressed={sort === 'recent'}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              sort === 'recent'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setSort('alpha')}
            aria-pressed={sort === 'alpha'}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              sort === 'alpha'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            A–Z
          </button>
        </div>
      </div>

      {tab === 'japanese' ? (
        q ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {renderWordList(
              sortWords((jpWords ?? []).filter((c) => matchesQuery(c, q)), sort),
              `No matches for “${query.trim()}”`,
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(jpSummary?.by_level ?? []).map((b) => {
              const levelWords = sortWords(
                (jpWords ?? []).filter((c) => c.jlpt_level === b.jlpt_level),
                sort,
              )
              const count = levelWords.length
              const isOpen = openLevel === b.jlpt_level
              const disabled = count === 0
              const pct = b.available > 0 ? Math.min(100, (count / b.available) * 100) : 0
              return (
                <div
                  key={b.jlpt_level}
                  className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
                >
                  <button
                    disabled={disabled}
                    onClick={() => setOpenLevel(isOpen ? null : b.jlpt_level)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold px-3 py-1 rounded-full border ${
                        jlptColor[b.jlpt_level] ?? jlptColor.Unknown
                      }`}
                    >
                      {b.jlpt_level}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full bg-gradient-to-r ${
                          jlptGradient[b.jlpt_level] ?? jlptGradient.Unknown
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 tabular-nums w-16 text-right">
                      {count}
                      <span className="text-gray-400 font-normal"> / {b.available}</span>
                    </span>
                    {!disabled && (
                      <span
                        className={`text-gray-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      >
                        ▼
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {renderWordList(levelWords, 'No words.')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {renderWordList(
            sortWords((enWords ?? []).filter((c) => matchesQuery(c, q)), sort),
            q ? `No matches for “${query.trim()}”` : 'No English words learned yet.',
          )}
        </div>
      )}

      {pending && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-4">
          <span className="truncate max-w-[60vw]">
            Unmarked <span className="font-semibold">{pending.card.japanese}</span>
            {pending.card.card_type !== 'english' && pending.card.furigana && (
              <span className="text-gray-400 font-normal"> ({pending.card.furigana})</span>
            )}
          </span>
          <button
            onClick={undoUnmark}
            className="font-semibold text-indigo-300 hover:text-indigo-200 shrink-0"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
