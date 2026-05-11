export interface Card {
  id: number
  card_type: string
  japanese: string
  furigana: string
  english: string
  example_sentence: string
  synonym: string
  jlpt_level: string
  created_at: string
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
