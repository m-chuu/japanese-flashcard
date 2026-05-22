import { useState, useEffect } from 'react'
import type { Card } from '../types'
import { updateCardNote } from '../api/client'
import YouGlishWidget from './YouGlishWidget'

interface Props {
  card: Card
  onQuality: (quality: number) => void
}

const ratings = [
  {
    label: 'Again',
    quality: 0,
    hint: '<1m',
    key: '1',
    style:
      'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-sm hover:shadow',
    keyStyle: 'bg-red-50 text-red-500',
  },
  {
    label: 'Hard',
    quality: 3,
    hint: '~1d',
    key: '2',
    style:
      'bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 shadow-sm hover:shadow',
    keyStyle: 'bg-orange-50 text-orange-500',
  },
  {
    label: 'Good',
    quality: 4,
    hint: '~3d',
    key: '3',
    style:
      'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm hover:shadow',
    keyStyle: 'bg-emerald-50 text-emerald-600',
  },
  {
    label: 'Easy',
    quality: 5,
    hint: '~7d',
    key: '4',
    style:
      'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 shadow-sm hover:shadow',
    keyStyle: 'bg-blue-50 text-blue-600',
  },
]

const jlptBadge: Record<string, string> = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-blue-100 text-blue-700',
  N3: 'bg-amber-100 text-amber-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
  Unknown: 'bg-gray-100 text-gray-500',
}

function CornerBadges({ card, isEnglish }: { card: Card; isEnglish: boolean }) {
  const badgeClass = isEnglish
    ? 'bg-emerald-100 text-emerald-700'
    : jlptBadge[card.jlpt_level] ?? jlptBadge.Unknown
  const label = isEnglish && card.jlpt_level === 'Unknown' ? 'EN' : card.jlpt_level
  return (
    <span
      className={`absolute top-4 left-4 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}
    >
      {label}
    </span>
  )
}

function JapaneseCard({ card }: { card: Card }) {
  return (
    <>
      {/* Front */}
      <div className="absolute inset-0 bg-gradient-to-br from-white to-indigo-50/30 rounded-3xl shadow-md ring-1 ring-gray-100 flex flex-col items-center justify-center gap-3 [backface-visibility:hidden]">
        <CornerBadges card={card} isEnglish={false} />
        <p className="text-6xl md:text-7xl font-extrabold text-gray-900 tracking-tight px-6 text-center leading-tight">
          {card.japanese}
        </p>
        <p className="absolute bottom-4 text-[11px] text-gray-400 tracking-wide uppercase font-medium">
          Tap or press Space
        </p>
      </div>

      {/* Back */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-3xl shadow-md ring-1 ring-indigo-100 flex flex-col items-center justify-center px-8 gap-3 [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <CornerBadges card={card} isEnglish={false} />
        {card.furigana && (
          <p className="text-2xl text-indigo-500 font-medium">{card.furigana}</p>
        )}
        <p className="text-xl text-gray-800 font-semibold text-center leading-snug">
          {card.english}
        </p>
        {card.example_sentence && (
          <p className="text-sm text-gray-500 text-center italic leading-relaxed max-w-md">
            "{card.example_sentence}"
          </p>
        )}
        {card.synonym && (
          <p className="text-xs text-gray-400 mt-1">≈ {card.synonym}</p>
        )}
      </div>
    </>
  )
}

function EnglishCard({ card }: { card: Card }) {
  return (
    <>
      {/* Front */}
      <div className="absolute inset-0 bg-gradient-to-br from-white to-emerald-50/30 rounded-3xl shadow-md ring-1 ring-gray-100 flex flex-col items-center justify-center gap-2 [backface-visibility:hidden]">
        <CornerBadges card={card} isEnglish={true} />
        <p className="text-5xl md:text-6xl font-extrabold text-gray-900 text-center px-6 tracking-tight">
          {card.japanese}
        </p>
        {card.furigana && (
          <p className="text-sm text-gray-400 mt-1">{card.furigana}</p>
        )}
        <p className="absolute bottom-4 text-[11px] text-gray-400 tracking-wide uppercase font-medium">
          Tap or press Space
        </p>
      </div>

      {/* Back */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl shadow-md ring-1 ring-emerald-100 flex flex-col items-start justify-center px-7 py-6 gap-2 [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <CornerBadges card={card} isEnglish={true} />
        <p className="text-lg text-gray-800 font-semibold leading-snug mt-4">
          {card.english}
        </p>
        {card.example_sentence && (
          <p className="text-sm text-gray-500 italic leading-relaxed">
            "{card.example_sentence}"
          </p>
        )}
        {card.synonym && (
          <p className="text-xs text-gray-400 mt-auto">≈ {card.synonym}</p>
        )}
      </div>
    </>
  )
}

export default function FlashCard({ card, onQuality }: Props) {
  const [flipped, setFlipped] = useState(false)
  const isEnglish = card.card_type === 'english'

  // Personal note — jot down something interesting about this word
  const [note, setNote] = useState(card.note ?? '')
  const [draft, setDraft] = useState(card.note ?? '')
  const [editingNote, setEditingNote] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  const handleQuality = (q: number) => {
    setFlipped(false)
    onQuality(q)
  }

  async function saveNote() {
    const trimmed = draft.trim()
    setSavingNote(true)
    try {
      await updateCardNote(card.id, trimmed)
      setNote(trimmed)
      setEditingNote(false)
    } finally {
      setSavingNote(false)
    }
  }

  // Keyboard shortcuts: Space/Enter to flip, 1-4 to rate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
        return
      }
      if (flipped) {
        const r = ratings.find((rt) => rt.key === e.key)
        if (r) {
          e.preventDefault()
          handleQuality(r.quality)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, card.id])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card */}
      <div
        className="w-full max-w-lg h-72 cursor-pointer [perspective:1200px]"
        onClick={() => setFlipped(!flipped)}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {isEnglish ? <EnglishCard card={card} /> : <JapaneseCard card={card} />}
        </div>
      </div>

      {/* Personal note — saved to this card, also shown on the Learned page */}
      <div className="w-full max-w-lg">
        {editingNote ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Something interesting about this word…"
              rows={3}
              className="w-full bg-transparent text-sm text-gray-700 resize-none outline-none placeholder:text-amber-400/70"
            />
            <div className="flex justify-end gap-1.5 mt-1">
              <button
                onClick={() => {
                  setDraft(note)
                  setEditingNote(false)
                }}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 px-3 py-1 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                disabled={savingNote}
                className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-3 py-1 rounded-lg transition-colors"
              >
                {savingNote ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>
        ) : note ? (
          <button
            onClick={() => {
              setDraft(note)
              setEditingNote(true)
            }}
            className="group w-full text-left bg-amber-50 border border-amber-200 hover:border-amber-300 rounded-2xl p-3 transition-colors"
          >
            <span className="flex items-center text-[10px] font-bold uppercase tracking-widest text-amber-500">
              📝 Note
              <span className="ml-auto normal-case tracking-normal font-medium text-gray-300 group-hover:text-amber-500">
                Edit
              </span>
            </span>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{note}</p>
          </button>
        ) : (
          <button
            onClick={() => {
              setDraft('')
              setEditingNote(true)
            }}
            className="w-full text-xs font-medium text-gray-400 hover:text-amber-600 border border-dashed border-gray-200 hover:border-amber-300 rounded-2xl py-2.5 transition-colors"
          >
            📝 Add a note
          </button>
        )}
      </div>

      {/* YouGlish pronunciation — shown below card after flip */}
      {flipped && (
        <div className="w-full max-w-lg animate-[fadeIn_0.3s_ease-out]">
          <p className="text-[10px] text-gray-400 font-bold mb-1.5 text-center tracking-widest uppercase">
            Pronunciation
          </p>
          <YouGlishWidget
            word={card.japanese}
            lang={isEnglish ? 'english' : 'japanese'}
          />
        </div>
      )}

      {/* Rating buttons — only visible after flip */}
      {flipped ? (
        <div className="flex flex-col items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
          <div className="flex gap-2.5 flex-wrap justify-center">
            {ratings.map(({ label, quality, hint, key, style, keyStyle }) => (
              <button
                key={label}
                onClick={() => handleQuality(quality)}
                className={`flex flex-col items-center min-w-[78px] px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 ${style}`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold w-4 h-4 inline-flex items-center justify-center rounded ${keyStyle}`}
                  >
                    {key}
                  </span>
                  {label}
                </span>
                <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                  {hint}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 tracking-wide uppercase font-medium mt-1">
            Use keys 1–4 to rate
          </p>
        </div>
      ) : (
        <button
          onClick={() => setFlipped(true)}
          className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors"
        >
          Press Space to reveal answer
        </button>
      )}
    </div>
  )
}
