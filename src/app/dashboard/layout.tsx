import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { DashboardNav } from '@/components/DashboardNav'

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
    <div className="min-h-screen bg-pharma-bg-primary">
      <header className="bg-pharma-bg-secondary border-b border-pharma px-6 py-4 sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link
            href="/dashboard"
            className="text-xl font-heading font-bold text-pharma-accent hover:text-pharma-accent-secondary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-2 focus-visible:rounded"
          >
            PharmaNavi
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-pharma-text-muted">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm px-4 py-2 rounded-lg text-pharma-text-secondary hover:text-pharma-text-primary hover:bg-pharma-bg-tertiary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-2"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <DashboardNav />

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
