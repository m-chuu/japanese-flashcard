import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getN1Progress } from '../api/client'
import type { N1Progress } from '../api/client'

export default function N1ProgressPage() {
  const [data, setData] = useState<N1Progress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getN1Progress()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-gray-400 text-sm animate-pulse">
        Loading N1 progress…
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-5xl mb-4">📭</p>
        <p className="text-gray-500 text-lg font-medium">No N1 cards found.</p>
        <p className="text-gray-400 text-sm mt-2">
          Run <code className="bg-gray-100 px-1 rounded">seed_n1.py</code> to import the N1 schedule.
        </p>
      </div>
    )
  }

  const overallPct = Math.round((data.unlocked / data.total) * 100)
  const masteredPct = Math.round((data.mastered / data.total) * 100)
  const dayPct = Math.round((data.current_day / data.total_days) * 100)

  const today = new Date()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header banner */}
      <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-3xl p-6 text-white shadow-xl shadow-red-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">JLPT N1 Journey</h1>
            <p className="text-red-100 text-sm mt-0.5">
              Day {data.current_day} of {data.total_days}
            </p>
          </div>
          <span className="text-6xl font-black text-white/20 select-none leading-none">N1</span>
        </div>

        {/* Day progress bar */}
        <div className="flex justify-between text-xs text-red-100 mb-1">
          <span>Schedule progress</span>
          <span>{dayPct}%</span>
        </div>
        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-white rounded-full transition-all duration-700"
            style={{ width: `${Math.max(dayPct, 1)}%` }}
          />
        </div>

        {/* Mini stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Unlocked', value: data.unlocked },
            { label: 'Due Today', value: data.due_today },
            { label: 'Mastered', value: data.mastered },
            { label: 'Locked', value: data.locked },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/15 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-red-100 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Overall mastery bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">Overall mastery</span>
          <span className="text-sm text-gray-400">{data.mastered} / {data.total} words</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-red-500 transition-all duration-700"
            style={{ width: `${masteredPct}%` }}
          />
          <div
            className="h-full bg-red-200 transition-all duration-700"
            style={{ width: `${Math.max(0, overallPct - masteredPct)}%` }}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Mastered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-200 inline-block" />In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-100 inline-block border border-gray-200" />Locked
          </span>
        </div>
      </div>

      {/* Today's new words */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800">
            Today's new words
            <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
              {data.todays_new_words.length}
            </span>
          </h2>
          {data.due_today > 0 && (
            <Link
              to="/study"
              className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-xl font-semibold transition-all hover:-translate-y-0.5 shadow-sm shadow-red-200"
            >
              Study Now →
            </Link>
          )}
        </div>

        {data.todays_new_words.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            No new words today — check back tomorrow!
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.todays_new_words.map((w) => (
              <div key={w.id} className="flex items-center gap-4 py-2.5">
                <span className="text-2xl font-bold text-gray-900 w-20 shrink-0">{w.japanese}</span>
                <span className="text-sm text-indigo-500 w-24 shrink-0">{w.furigana}</span>
                <span className="text-sm text-gray-500 truncate">{w.english}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming 7 days */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">Upcoming schedule</h2>
        <div className="grid grid-cols-7 gap-2">
          {data.upcoming.map(({ day_offset, new_words }) => {
            const d = new Date(today)
            d.setDate(d.getDate() + day_offset)
            return (
              <div key={day_offset} className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{dayNames[d.getDay()]}</span>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
                    new_words > 0
                      ? 'bg-red-50 text-red-600 border border-red-100'
                      : 'bg-gray-50 text-gray-300 border border-gray-100'
                  }`}
                >
                  {new_words > 0 ? `+${new_words}` : '—'}
                </div>
                <span className="text-xs text-gray-300">{d.getDate()}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-300 pb-4">
        {data.total} N1 words · {data.total_days} days · 10 new words/day
      </p>
    </div>
  )
}
