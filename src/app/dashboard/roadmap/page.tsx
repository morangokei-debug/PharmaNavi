import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function RoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('pharma_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  let kasanList: { id: string; code: string; name: string; points: number }[] = []
  let pharmacyIds: string[] = []
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (profile?.organization_id) {
    const { data: ph } = await supabase
      .from('pharma_pharmacies')
      .select('id')
      .eq('organization_id', profile.organization_id)
    pharmacyIds = ph?.map((p) => p.id) ?? []

    const { data: kasan } = await supabase
      .from('pharma_kasan_master')
      .select('id, code, name, points')
      .eq('revision_year', 2024)
      .order('code')
    kasanList = kasan ?? []
  }

  const statusMap: Record<string, string> = {}
  if (pharmacyIds.length && kasanList.length) {
    const { data: statuses } = await supabase
      .from('pharma_kasan_status')
      .select('kasan_id, status')
      .in('pharmacy_id', pharmacyIds)
      .eq('year_month', ym)
    statuses?.forEach((s) => {
      const key = s.kasan_id
      if (!statusMap[key] || s.status === 'achieved') statusMap[key] = s.status
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">加算ロードマップ</h1>
      <p className="text-slate-600 mb-6">対象月: {ym}</p>

      {!profile?.organization_id || pharmacyIds.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-amber-800 font-medium">組織・店舗の設定が必要です</p>
          <p className="text-amber-700 text-sm mt-2">
            <Link href="/dashboard/settings" className="underline">設定</Link>から組織と店舗を作成してください。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {kasanList.map((k) => {
            const status = statusMap[k.id] ?? 'pending'
            const badge =
              status === 'achieved' ? 'bg-emerald-100 text-emerald-800' :
              status === 'partial' ? 'bg-amber-100 text-amber-800' :
              'bg-slate-100 text-slate-600'
            return (
              <div
                key={k.id}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold text-slate-800">{k.name}</h3>
                  <p className="text-sm text-slate-600">{k.points}点</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge}`}>
                  {status === 'achieved' ? '達成' : status === 'partial' ? '一部達成' : '未達'}
                </span>
              </div>
            )
          })}
          {kasanList.length === 0 && (
            <p className="text-slate-600">加算マスタが登録されていません。SQLでシードデータを投入してください。</p>
          )}
        </div>
      )}
    </div>
  )
}
