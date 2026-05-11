import axios from 'axios'
import type { Card, JishoLookup, EnglishLookup } from '../types'

const api = axios.create({ baseURL: 'http://localhost:8000' })

export const getCards = (jlptLevel?: string, cardType?: string) =>
  api.get<Card[]>('/cards/', {
    params: {
      ...(jlptLevel ? { jlpt_level: jlptLevel } : {}),
      ...(cardType ? { card_type: cardType } : {}),
    },
  })

export const getCard = (id: number) => api.get<Card>(`/cards/${id}`)

export const createCard = (data: Partial<Card>) => api.post<Card>('/cards/', data)

export const updateCard = (id: number, data: Partial<Card>) =>
  api.put<Card>(`/cards/${id}`, data)

export const deleteCard = (id: number) => api.delete(`/cards/${id}`)

export const lookupWord = (word: string) =>
  api.get<JishoLookup>(`/cards/lookup/${encodeURIComponent(word)}`)

export const lookupEnglishWord = (word: string) =>
  api.get<EnglishLookup>(`/cards/english-lookup/${encodeURIComponent(word)}`)

export const getDueCards = (cardType?: string) =>
  api.get<Card[]>('/reviews/due', { params: cardType ? { card_type: cardType } : {} })

export const submitReview = (cardId: number, quality: number) =>
  api.post('/reviews/', { card_id: cardId, quality })

export async function extractText(dataURL: string): Promise<string> {
  const blob = dataURLToBlob(dataURL)
  const form = new FormData()
  form.append('file', blob, 'screenshot.png')
  const res = await api.post<{ text: string }>('/ocr/extract', form)
  return res.data.text
}

function dataURLToBlob(dataURL: string): Blob {
  const [header, data] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)![1]
  const binary = atob(data)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return new Blob([buf], { type: mime })
}
