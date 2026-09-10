import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createCard, updateCard, lookupWord } from '../api/client'
import { JLPT_LEVELS } from '../types'
import type { Card } from '../types'

const emptyForm = {
  japanese: '',
  furigana: '',
  english: '',
  example_sentence: '',
  synonym: '',
  jlpt_level: 'Unknown',
}

function formFrom(card: Card) {
  return {
    japanese: card.japanese ?? '',
    furigana: card.furigana ?? '',
    english: card.english ?? '',
    example_sentence: card.example_sentence ?? '',
    synonym: card.synonym ?? '',
    jlpt_level: card.jlpt_level || 'Unknown',
  }
}

/** `card` is supplied by EditCard; without it this is the create form. */
export default function AddCard({ card }: { card?: Card }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = !!card

  const [form, setForm] = useState(() => (card ? formFrom(card) : emptyForm))
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  const handleLookup = useCallback(async (word: string) => {
    if (!word.trim()) return
    setLookingUp(true)
    try {
      const res = await lookupWord(word.trim())
      if (res.data.found) {
        setForm((f) => ({
          ...f,
          furigana: res.data.furigana || f.furigana,
          english: res.data.english || f.english,
          jlpt_level: res.data.jlpt_level || f.jlpt_level,
        }))
      }
    } catch {
      // Jisho may be unreachable; silently fail
    } finally {
      setLookingUp(false)
    }
  }, [])

  // Pre-fill from OCR (navigated here with state.ocrText)
  useEffect(() => {
    const state = location.state as { ocrText?: string } | null
    if (state?.ocrText) {
      const text = state.ocrText
      setForm((f) => ({ ...f, japanese: text }))
      handleLookup(text)
      // Clear the navigation state so it doesn't re-trigger on re-render
      window.history.replaceState({}, '')
    }
  }, [location.state, handleLookup])

  function set(key: string) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (card) {
        // card_type has to travel with the update: the backend writes every
        // field of CardCreate, and its card_type defaults to "japanese", so
        // omitting it would move the card into the other deck.
        await updateCard(card.id, { ...form, card_type: card.card_type })
      } else {
        await createCard({ ...form, card_type: 'japanese' })
      }
      navigate('/')
    } catch (err) {
      console.error('Failed to save card:', err)
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {isEdit ? 'Edit Card' : 'Add Card'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Japanese */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Japanese <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <input
              value={form.japanese}
              onChange={set('japanese')}
              required
              placeholder="日本語"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              disabled={lookingUp || !form.japanese.trim()}
              onClick={() => handleLookup(form.japanese)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 text-sm whitespace-nowrap"
            >
              {lookingUp ? '…' : 'Lookup'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Paste a Japanese word and click Lookup to auto-fill from Jisho
          </p>
        </div>

        {/* Furigana */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Furigana</label>
          <input
            value={form.furigana}
            onChange={set('furigana')}
            placeholder="ふりがな"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* English */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">English meaning</label>
          <input
            value={form.english}
            onChange={set('english')}
            placeholder="meaning / translation"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Example sentence */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Example sentence
          </label>
          <textarea
            value={form.example_sentence}
            onChange={set('example_sentence')}
            placeholder="例文…"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        {/* Synonym */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Synonym</label>
          <input
            value={form.synonym}
            onChange={set('synonym')}
            placeholder="similar words…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* JLPT level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">JLPT Level</label>
          <select
            value={form.jlpt_level}
            onChange={set('jlpt_level')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {JLPT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving…' : isEdit ? 'Update Card' : 'Add Card'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
