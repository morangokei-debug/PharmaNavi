'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pharma-bg-primary">
      <div className="w-full max-w-md p-8 bg-pharma-bg-secondary border border-pharma rounded-2xl shadow-xl">
        <h1 className="text-2xl font-heading font-bold text-center text-pharma-text-primary mb-2">
          PharmaNavi
        </h1>
        <p className="text-center text-pharma-text-muted text-sm mb-8">
          調剤薬局コンサルシステム
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary placeholder-pharma-muted transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-pharma-focus focus:ring-[3px] focus:ring-[var(--accent-glow)] focus:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed"
              placeholder="example@pharmacy.jp"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary placeholder-pharma-muted transition-[border-color,box-shadow] duration-200 focus:outline-none focus:border-pharma-focus focus:ring-[3px] focus:ring-[var(--accent-glow)] focus:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 text-sm text-pharma-error bg-pharma-bg-tertiary border border-pharma-error/50 p-3 rounded-lg"
            >
              <span aria-hidden>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[40px] py-3 px-6 bg-pharma-accent text-white font-semibold rounded-lg shadow-glow transition-all duration-200 hover:bg-pharma-accent-secondary hover:shadow-glow-lg active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-3"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
                ログイン中...
              </span>
            ) : (
              'ログイン'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
