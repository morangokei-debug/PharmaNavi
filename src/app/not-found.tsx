import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-pharma-bg-primary flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-4xl font-heading font-bold text-pharma-text-primary mb-2">404</h1>
        <p className="text-pharma-text-muted mb-6">ページが見つかりません</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-pharma-accent text-white font-semibold rounded-xl hover:bg-pharma-accent-secondary transition-colors shadow-lg"
        >
          トップへ戻る
        </Link>
      </div>
    </div>
  )
}
