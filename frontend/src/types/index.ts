export interface Card {
  id: number
  card_type: string
  japanese: string
  furigana: string
  english: string
  example_sentence: string
  synonym: string
  jlpt_level: string
  note: string
  created_at: string
  /**
   * Days until the next review for each rating button, keyed by SM-2 quality
   * (0 = Again, 3 = Hard, 4 = Good, 5 = Easy). Only sent by /reviews/due —
   * absent when a card comes from the card list or the learned view.
   */
  next_intervals?: Record<number, number>
}

export interface EnglishLookup {
  found: boolean
  word?: string
  phonetic?: string
  definition?: string
  example?: string
  synonyms?: string
  part_of_speech?: string
}

export interface Review {
  id: number
  card_id: number
  ease_factor: number
  interval: number
  repetitions: number
  next_review: string
  last_reviewed: string | null
  learned_at: string | null
}

export interface IdiomLookup {
  found: boolean
  idiom?: string
  meaning?: string
  example?: string
  formality?: string
  related?: string
}

export interface JishoLookup {
  found: boolean
  furigana?: string
  english?: string
  parts_of_speech?: string[]
  jlpt_level?: string
}

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'Unknown'] as const
export type JLPTLevel = (typeof JLPT_LEVELS)[number]
