import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatRequirementsJson } from '@/lib/format-requirements'

export default async function RoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('pharma_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  let kasanList: { id: string; code: string; name: string; points: number; requirements_json: unknown }[] = []
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
      .select('id, code, name, points, requirements_json')
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
      <h1 className="text-2xl font-heading font-bold text-pharma-text-primary mb-6">加算ロードマップ</h1>
      <p className="text-pharma-text-muted mb-6">対象月: {ym}</p>

      {!profile?.organization_id || pharmacyIds.length === 0 ? (
        <div className="bg-pharma-bg-secondary border border-pharma-warning/50 rounded-xl p-6">
          <p className="text-pharma-warning font-medium">組織・店舗の設定が必要です</p>
          <p className="text-pharma-text-secondary text-sm mt-2">
            <Link href="/dashboard/settings" className="text-pharma-accent underline hover:text-pharma-accent-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:rounded">設定</Link>から組織と店舗を作成してください。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {kasanList.map((k) => {
            const status = statusMap[k.id] ?? 'pending'
            const badge =
              status === 'achieved' ? 'bg-pharma-success/20 text-pharma-success border-pharma-success/40' :
              status === 'partial' ? 'bg-pharma-warning/20 text-pharma-warning border-pharma-warning/40' :
              'bg-pharma-bg-tertiary text-pharma-text-muted border-pharma'
            const conditions = formatRequirementsJson(k.requirements_json)
            return (
              <div
                key={k.id}
                className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-pharma-text-primary">{k.name}</h3>
                    <p className="text-sm text-pharma-text-muted">{k.points}点</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${badge}`}>
                    {status === 'achieved' ? '達成' : status === 'partial' ? '一部達成' : '未達'}
                  </span>
                </div>
                {conditions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-pharma">
                    <p className="text-xs font-medium text-pharma-text-muted mb-1">達成条件</p>
                    <ul className="text-sm text-pharma-text-secondary space-y-0.5">
                      {conditions.map((c, i) => (
                        <li key={i}>・{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
          {kasanList.length === 0 && (
            <div className="bg-pharma-bg-secondary rounded-xl p-12 text-center">
              <p className="text-pharma-text-muted text-lg mb-2">加算マスタが登録されていません</p>
              <p className="text-pharma-text-muted text-sm">SQL Editorでシードデータを投入してください。</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
