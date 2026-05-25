import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getLearnedSummary,
  getLearnedWords,
  unmarkLearned,
} from '../api/client'
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

export default function Learned() {
  const [tab, setTab] = useState<Tab>('japanese')

  // Japanese tab state
  const [jpSummary, setJpSummary] = useState<LearnedSummary | null>(null)
  const [openLevel, setOpenLevel] = useState<string | null>(null)
  const [wordsByLevel, setWordsByLevel] = useState<Record<string, Card[]>>({})
  const [loadingLevel, setLoadingLevel] = useState<string | null>(null)

  // English tab state
  const [enWords, setEnWords] = useState<Card[] | null>(null)
  const [enCount, setEnCount] = useState<number>(0)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [jp, enSum] = await Promise.all([
        getLearnedSummary('japanese'),
        getLearnedSummary('english'),
      ])
      setJpSummary(jp.data)
      setEnCount(enSum.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'english' && enWords === null) {
      getLearnedWords(undefined, 'english').then((r) => setEnWords(r.data))
    }
  }, [tab, enWords])

  async function toggleLevel(level: string) {
    if (openLevel === level) {
      setOpenLevel(null)
      return
    }
    setOpenLevel(level)
    if (!wordsByLevel[level]) {
      setLoadingLevel(level)
      try {
        const r = await getLearnedWords(level, 'japanese')
        setWordsByLevel((prev) => ({ ...prev, [level]: r.data }))
      } finally {
        setLoadingLevel(null)
      }
    }
  }

  async function handleUnmarkJp(level: string, cardId: number) {
    if (!confirm('Remove this word from your learned list? Its review progress will reset.')) return
    await unmarkLearned(cardId)
    setWordsByLevel((prev) => ({
      ...prev,
      [level]: (prev[level] ?? []).filter((c) => c.id !== cardId),
    }))
    setJpSummary((prev) =>
      prev
        ? {
            total: prev.total - 1,
            by_level: prev.by_level.map((b) =>
              b.jlpt_level === level ? { ...b, count: Math.max(0, b.count - 1) } : b,
            ),
          }
        : prev,
    )
  }

  async function handleUnmarkEn(cardId: number) {
    if (!confirm('Remove this word from your learned list? Its review progress will reset.')) return
    await unmarkLearned(cardId)
    setEnWords((prev) => (prev ?? []).filter((c) => c.id !== cardId))
    setEnCount((prev) => Math.max(0, prev - 1))
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-16">Loading…</p>
  }

  const totalAll = (jpSummary?.total ?? 0) + enCount
  if (totalAll === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">📖</p>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No learned words yet</h2>
        <p className="text-gray-500 mb-8">
          Words you've studied will show up here.
        </p>
        <Link
          to="/study"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-semibold shadow-md shadow-indigo-200"
        >
          Start studying →
        </Link>
      </div>
    )
  }

  const headerCount = tab === 'japanese' ? (jpSummary?.total ?? 0) : enCount
  const headerLabel = tab === 'japanese' ? 'Japanese Words Learned' : 'English Words Learned'

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

      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('japanese')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            tab === 'japanese'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🇯🇵 Japanese
          <span className="ml-2 text-xs text-gray-400 tabular-nums">{jpSummary?.total ?? 0}</span>
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

      {tab === 'japanese' ? (
        <div className="flex flex-col gap-3">
          {(jpSummary?.by_level ?? []).map((b) => {
            const isOpen = openLevel === b.jlpt_level
            const words = wordsByLevel[b.jlpt_level] ?? []
            const isLoading = loadingLevel === b.jlpt_level
            const disabled = b.count === 0
            const jpTotal = jpSummary?.total ?? 0
            return (
              <div
                key={b.jlpt_level}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
              >
                <button
                  disabled={disabled}
                  onClick={() => toggleLevel(b.jlpt_level)}
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
                      style={{
                        width: `${jpTotal > 0 ? (b.count / jpTotal) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-lg font-bold text-gray-800 tabular-nums w-12 text-right">
                    {b.count}
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
                    {isLoading ? (
                      <p className="text-center text-gray-400 py-6 text-sm">Loading…</p>
                    ) : words.length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-sm">No words.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {words.map((c) => (
                          <li
                            key={c.id}
                            className="px-5 py-3 flex items-start gap-4 group hover:bg-white transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-lg font-bold text-gray-900 truncate">
                                {c.japanese}
                                {c.furigana && (
                                  <span className="ml-2 text-sm font-medium text-indigo-500">
                                    {c.furigana}
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500 truncate">{c.english}</p>
                              {c.note && (
                                <p className="mt-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words">
                                  📝 {c.note}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleUnmarkJp(b.jlpt_level, c.id)}
                              className="text-xs text-gray-400 hover:text-red-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                            >
                              Unmark
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {enWords === null ? (
            <p className="text-center text-gray-400 py-6 text-sm">Loading…</p>
          ) : enWords.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              No English words learned yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {enWords.map((c) => (
                <li
                  key={c.id}
                  className="px-5 py-3 flex items-start gap-4 group hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-900 truncate">
                      {c.japanese}
                      {c.furigana && (
                        <span className="ml-2 text-sm font-medium text-indigo-500">
                          {c.furigana}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{c.english}</p>
                    {c.note && (
                      <p className="mt-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words">
                        📝 {c.note}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnmarkEn(c.id)}
                    className="text-xs text-gray-400 hover:text-red-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  >
                    Unmark
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
