'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/dashboard/roadmap', label: '加算ロードマップ' },
  { href: '/dashboard/tasks', label: 'タスク' },
  { href: '/dashboard/input', label: 'データ入力' },
  { href: '/dashboard/settings', label: '設定' },
] as const

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-pharma-bg-secondary border-b border-pharma px-6" role="navigation" aria-label="メインメニュー">
      <div className="max-w-7xl mx-auto flex gap-1 py-3">
        {links.map(({ href, label }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-2 ${
                isActive
                  ? 'bg-pharma-accent text-white'
                  : 'text-pharma-text-secondary hover:text-pharma-text-primary hover:bg-pharma-bg-tertiary'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
