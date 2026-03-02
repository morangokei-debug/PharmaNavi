import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('pharma_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  let achievedCount = 0
  let totalCount = 0
  let pharmacyCount = 0

  if (profile?.organization_id) {
    const { data: pharmacies } = await supabase
      .from('pharma_pharmacies')
      .select('id')
      .eq('organization_id', profile.organization_id)
    pharmacyCount = pharmacies?.length ?? 0

    const { data: kasanList } = await supabase
      .from('pharma_kasan_master')
      .select('id')
      .eq('revision_year', 2024)
    totalCount = kasanList?.length ?? 0

    if (pharmacies?.length && kasanList?.length) {
      const now = new Date()
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const { data: statuses } = await supabase
        .from('pharma_kasan_status')
        .select('status')
        .in('pharmacy_id', pharmacies.map((p) => p.id))
        .eq('year_month', ym)
        .eq('status', 'achieved')
      achievedCount = statuses?.length ?? 0
    }
  }

  const achievementRate = totalCount > 0 ? Math.round((achievedCount / (totalCount * Math.max(pharmacyCount, 1))) * 100) : 0
  const pendingCount = Math.max(0, (totalCount * Math.max(pharmacyCount, 1)) - achievedCount)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">算定済み加算数</p>
          <p className="text-3xl font-bold text-emerald-600">{achievedCount}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">達成率</p>
          <p className="text-3xl font-bold text-slate-800">{achievementRate}%</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-600 mb-1">未達加算数</p>
          <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">ようこそ</h2>
        {!profile?.organization_id ? (
          <p className="text-slate-600">
            <Link href="/dashboard/settings" className="text-emerald-600 underline font-medium">設定</Link>
            から組織と店舗を作成してください。その後、
            <Link href="/dashboard/input" className="text-emerald-600 underline font-medium">データ入力</Link>
            で実績を登録できます。
          </p>
        ) : pharmacyCount === 0 ? (
          <p className="text-slate-600">
            設定で店舗を追加してください。店舗を登録すると、データ入力と加算の進捗表示が可能になります。
          </p>
        ) : (
          <p className="text-slate-600">
            データ入力で実績を登録すると、加算ロードマップに進捗が反映されます。
          </p>
        )}
      </div>
    </div>
  )
}
