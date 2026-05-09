import { useState } from 'react'
import type { Card } from '../types'

interface Props {
  card: Card
  onQuality: (quality: number) => void
}

const ratings = [
  { label: 'Again', quality: 0, style: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { label: 'Hard',  quality: 3, style: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  { label: 'Good',  quality: 4, style: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { label: 'Easy',  quality: 5, style: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
]

export default function FlashCard({ card, onQuality }: Props) {
  const [flipped, setFlipped] = useState(false)

  const handleQuality = (q: number) => {
    setFlipped(false)
    onQuality(q)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Card */}
      <div
        className="w-full max-w-lg h-64 cursor-pointer [perspective:1000px]"
        onClick={() => setFlipped(!flipped)}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* Front */}
          <div className="absolute inset-0 bg-white rounded-2xl shadow-md flex flex-col items-center justify-center gap-2 [backface-visibility:hidden]">
            <p className="text-6xl font-bold text-gray-900">{card.japanese}</p>
            <p className="text-xs text-gray-400 mt-2">tap to reveal</p>
          </div>

          {/* Back */}
          <div className="absolute inset-0 bg-indigo-50 rounded-2xl shadow-md flex flex-col items-center justify-center px-8 gap-3 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {card.furigana && (
              <p className="text-2xl text-indigo-500 font-medium">{card.furigana}</p>
            )}
            <p className="text-xl text-gray-800 font-semibold text-center">{card.english}</p>
            {card.example_sentence && (
              <p className="text-sm text-gray-500 text-center italic">{card.example_sentence}</p>
            )}
            {card.synonym && (
              <p className="text-xs text-gray-400">≈ {card.synonym}</p>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons — only visible after flip */}
      {flipped && (
        <div className="flex gap-3">
          {ratings.map(({ label, quality, style }) => (
            <button
              key={label}
              onClick={() => handleQuality(quality)}
              className={`px-6 py-2 rounded-xl font-medium text-sm transition-colors ${style}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
