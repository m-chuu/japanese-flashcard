import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Study from './pages/Study'
import AddCard from './pages/AddCard'
import AddEnglishCard from './pages/AddEnglishCard'
import { extractText } from './api/client'

type Status = { type: 'processing' | 'error'; message: string } | null

function AppContent() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.onSendToOCR(async (dataURL: string) => {
      setStatus({ type: 'processing', message: 'Sending to OCR…' })

      // If first run, EasyOCR downloads the model — warn after 5 s
      const slowTimer = setTimeout(() => {
        setStatus({ type: 'processing', message: 'Downloading OCR model (first run, ~1 min)…' })
      }, 5000)

      try {
        const text = await extractText(dataURL)
        clearTimeout(slowTimer)

        if (!text.trim()) {
          setStatus({ type: 'error', message: 'No text found in the selected region. Try again.' })
          setTimeout(() => setStatus(null), 4000)
          return
        }

        setStatus(null)
        navigate('/add', { state: { ocrText: text.trim() } })
      } catch (err) {
        clearTimeout(slowTimer)
        console.error('OCR failed:', err)
        setStatus({
          type: 'error',
          message: 'OCR failed — is the backend running at localhost:8000?',
        })
        setTimeout(() => setStatus(null), 6000)
      }
    })

    return () => window.electronAPI?.removeSendToOCR()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Status toast */}
      {status && (
        <div
          className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm ${
            status.type === 'processing' ? 'bg-indigo-600' : 'bg-red-500'
          }`}
        >
          {status.type === 'processing' && (
            <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          <span>{status.message}</span>
          <button onClick={() => setStatus(null)} className="ml-auto shrink-0 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/study" element={<Study />} />
          <Route path="/add" element={<AddCard />} />
          <Route path="/edit/:id" element={<AddCard />} />
          <Route path="/add-english" element={<AddEnglishCard />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
