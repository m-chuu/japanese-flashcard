import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCard, lookupEnglishWord } from '../api/client'

const emptyForm = {
  word: '',
  phonetic: '',
  definition: '',
  example: '',
  synonyms: '',
  part_of_speech: '',
}

export default function AddEnglishCard() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const handleLookup = useCallback(async (word: string) => {
    if (!word.trim()) return
    setLookingUp(true)
    setNotFound(false)
    try {
      const res = await lookupEnglishWord(word.trim())
      if (res.data.found) {
        setForm((f) => ({
          ...f,
          word: res.data.word ?? f.word,
          phonetic: res.data.phonetic ?? f.phonetic,
          definition: res.data.definition ?? f.definition,
          example: res.data.example ?? f.example,
          synonyms: res.data.synonyms ?? f.synonyms,
          part_of_speech: res.data.part_of_speech ?? f.part_of_speech,
        }))
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    } finally {
      setLookingUp(false)
    }
  }, [])

  function set(key: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createCard({
        card_type: 'english',
        japanese: form.word,           // word stored in 'japanese' field (the term)
        furigana: form.phonetic,       // IPA stored in 'furigana'
        english: form.definition,
        example_sentence: form.example,
        synonym: form.synonyms,
        jlpt_level: form.part_of_speech || 'Unknown',
      })
      navigate('/')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🇬🇧</span>
        <h2 className="text-2xl font-bold text-gray-800">Add English Card</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Word */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Word <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <input
              value={form.word}
              onChange={set('word')}
              required
              placeholder="e.g. ephemeral"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="button"
              disabled={lookingUp || !form.word.trim()}
              onClick={() => handleLookup(form.word)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 text-sm whitespace-nowrap"
            >
              {lookingUp ? '…' : 'Lookup'}
            </button>
          </div>
          {notFound && (
            <p className="text-xs text-red-400 mt-1">Word not found — fill in the fields manually.</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Type an English word and click Lookup to auto-fill from Free Dictionary API
          </p>
        </div>

        {/* Phonetic */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phonetic (IPA)</label>
          <input
            value={form.phonetic}
            onChange={set('phonetic')}
            placeholder="/ɪˈfɛm(ə)r(ə)l/"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {/* Part of speech */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Part of speech</label>
          <input
            value={form.part_of_speech}
            onChange={set('part_of_speech')}
            placeholder="adjective, noun, verb…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {/* Definition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Definition <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.definition}
            onChange={set('definition')}
            required
            placeholder="lasting for a very short time"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
        </div>

        {/* Example sentence */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Example sentence</label>
          <textarea
            value={form.example}
            onChange={set('example')}
            placeholder="Fashions are ephemeral."
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
        </div>

        {/* Synonyms */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Synonyms</label>
          <input
            value={form.synonyms}
            onChange={set('synonyms')}
            placeholder="transitory, transient, fleeting…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving…' : 'Add English Card'}
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
