import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-xl font-bold text-emerald-700">
            PharmaNavi
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-8 py-3">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ダッシュボード
          </Link>
          <Link
            href="/dashboard/roadmap"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            加算ロードマップ
          </Link>
          <Link
            href="/dashboard/input"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            データ入力
          </Link>
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            設定
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
