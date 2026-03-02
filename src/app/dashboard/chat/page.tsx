'use client'

import { useState, useRef, useEffect } from 'react'

type Message = { role: 'user' | 'assistant'; text: string }

const SUGGESTIONS = [
  '地域支援体制加算1を取るには何をすればいい？',
  '連携強化加算の達成条件を教えて',
  '在宅訪問の件数目標は？',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました')
        setMessages((prev) => prev.slice(0, -1))
        return
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: data.message ?? '' }])
    } catch {
      setError('通信エラーが発生しました')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const inputBase = 'w-full px-4 py-3 bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary placeholder-pharma-muted focus:outline-none focus:border-pharma-focus focus:ring-[3px] focus:ring-[var(--accent-glow)] disabled:opacity-40 disabled:cursor-not-allowed'
  const btnPrimary = 'min-h-[40px] px-6 py-3 bg-pharma-accent text-white font-semibold rounded-lg shadow-glow hover:bg-pharma-accent-secondary active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-3'

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <h1 className="text-2xl font-heading font-bold text-pharma-text-primary mb-2">
        加算アドバイス
      </h1>
      <p className="text-pharma-text-muted text-sm mb-6">
        加算の達成方法や届出について質問できます。現在の達成状況を考慮してアドバイスします。
      </p>

      <div className="flex-1 flex flex-col min-h-0 bg-pharma-bg-secondary rounded-xl border border-pharma">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-pharma-text-muted mb-4">例：</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(s)}
                    className="px-4 py-2 text-sm bg-pharma-bg-tertiary hover:bg-pharma-accent/20 text-pharma-text-secondary hover:text-pharma-accent rounded-lg border border-pharma transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-2"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  m.role === 'user'
                    ? 'bg-pharma-accent text-white'
                    : 'bg-pharma-bg-tertiary text-pharma-text-primary border border-pharma'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-pharma-bg-tertiary rounded-xl px-4 py-3 border border-pharma">
                <span className="inline-flex items-center gap-2 text-pharma-text-muted text-sm">
                  <span className="w-4 h-4 border-2 border-pharma-accent/30 border-t-pharma-accent rounded-full animate-spin" aria-hidden />
                  考え中...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-lg text-sm bg-pharma-error/10 text-pharma-error border border-pharma-error/50">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-pharma">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="質問を入力..."
              className={inputBase}
              disabled={loading}
              aria-label="メッセージ入力"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`${btnPrimary} shrink-0`}
            >
              送信
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
