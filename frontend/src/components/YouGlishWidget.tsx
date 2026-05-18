import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    YG?: {
      Widget: new (
        id: string,
        config: { width: number | string; components: number; autostart: number },
      ) => { fetch: (word: string, lang: string) => void; destroy: () => void }
    }
  }
}

const WIDGET_SCRIPT = 'https://youglish.com/public/emb/widget.js'

interface Props {
  word: string
  lang?: 'english' | 'japanese'
}

export default function YouGlishWidget({ word, lang = 'english' }: Props) {
  const widgetRef = useRef<{ fetch: (w: string, l: string) => void; destroy: () => void } | null>(null)
  const containerId = 'youglish-widget-container'

  useEffect(() => {
    function initWidget() {
      if (!window.YG?.Widget) return
      widgetRef.current?.destroy()
      widgetRef.current = new window.YG.Widget(containerId, {
        width: '100%',
        components: 8415,
        autostart: 0,
      })
      widgetRef.current.fetch(word, lang)
    }

    const existing = document.querySelector(`script[src="${WIDGET_SCRIPT}"]`)
    if (existing) {
      // Script already loaded — init immediately (or wait a tick if YG not ready yet)
      if (window.YG?.Widget) {
        initWidget()
      } else {
        existing.addEventListener('load', initWidget, { once: true })
      }
    } else {
      const script = document.createElement('script')
      script.src = WIDGET_SCRIPT
      script.async = true
      script.addEventListener('load', initWidget, { once: true })
      document.body.appendChild(script)
    }

    return () => {
      try { widgetRef.current?.destroy() } catch (_) { /* ignore cleanup errors */ }
      widgetRef.current = null
    }
  }, [word])

  return (
    <div className="w-full mt-3">
      <div id={containerId} />
      <a
        href={`https://youglish.com/pronounce/${encodeURIComponent(word)}/${lang}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-xs text-indigo-400 hover:text-indigo-600 mt-1"
      >
        Open in YouGlish ↗
      </a>
    </div>
  )
}
