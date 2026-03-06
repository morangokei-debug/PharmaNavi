'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function getPast12Months(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

type Pharmacy = { id: string; name: string; chozai_kihon?: number }
type Kasan = { id: string; code: string; name: string; points: number }
type Status = { pharmacy_id: string; kasan_id: string; year_month: string; status: string }

type ChozaiFilter = 'all' | '1' | '23'

function filterKasanByChozai(list: Kasan[], filter: ChozaiFilter): Kasan[] {
  if (filter === '1') {
    return list.filter((k) => !k.code.startsWith('chiiki_iryo_') || ['chiiki_iryo_1', 'chiiki_iryo_2', 'chiiki_iryo_3'].includes(k.code))
  }
  if (filter === '23') {
    return list.filter((k) => !k.code.startsWith('chiiki_iryo_') || ['chiiki_iryo_1', 'chiiki_iryo_4', 'chiiki_iryo_5'].includes(k.code))
  }
  return list
}

function appliesToPharmacy(kasanCode: string, chozai: number): boolean {
  if (!kasanCode.startsWith('chiiki_iryo_')) return true
  if (kasanCode === 'chiiki_iryo_1') return true
  if (['chiiki_iryo_2', 'chiiki_iryo_3'].includes(kasanCode)) return chozai === 1
  if (['chiiki_iryo_4', 'chiiki_iryo_5'].includes(kasanCode)) return chozai === 2 || chozai === 3
  return true
}

export default function AdminPage() {
  const supabase = createClient()
  const past12Months = useMemo(() => getPast12Months(), [])
  const currentMonth = past12Months[past12Months.length - 1]

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [kasanList, setKasanList] = useState<Kasan[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [chozaiFilter, setChozaiFilter] = useState<ChozaiFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('pharma_profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) {
        setLoading(false)
        return
      }

      const { data: ph } = await supabase
        .from('pharma_pharmacies')
        .select('id, name, chozai_kihon')
        .eq('organization_id', profile.organization_id)
        .order('name')
      setPharmacies(ph ?? [])

      const { data: kasan } = await supabase
        .from('pharma_kasan_master')
        .select('id, code, name, points')
        .eq('revision_year', 2026)
        .order('code')
      setKasanList(kasan ?? [])

      if (ph?.length) {
        const phIds = ph.map((p) => p.id)
        const { data: st } = await supabase
          .from('pharma_kasan_status')
          .select('pharmacy_id, kasan_id, year_month, status')
          .in('pharmacy_id', phIds)
          .in('year_month', past12Months)
        setStatuses(st ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const statusMap = useMemo(() => {
    const m: Record<string, Record<string, string>> = {}
    statuses.forEach((s) => {
      if (!m[s.pharmacy_id]) m[s.pharmacy_id] = {}
      m[s.pharmacy_id][`${s.kasan_id}:${s.year_month}`] = s.status
    })
    return m
  }, [statuses])

  const filteredPharmacies = useMemo(() => {
    if (chozaiFilter === 'all') return pharmacies
    if (chozaiFilter === '1') return pharmacies.filter((p) => (p.chozai_kihon ?? 1) === 1)
    return pharmacies.filter((p) => (p.chozai_kihon ?? 1) === 2 || (p.chozai_kihon ?? 1) === 3)
  }, [pharmacies, chozaiFilter])

  const displayKasan = useMemo(
    () => filterKasanByChozai(kasanList, chozaiFilter),
    [kasanList, chozaiFilter]
  )

  function getStatus(pharmacyId: string, kasanId: string, ym: string): string {
    return statusMap[pharmacyId]?.[`${kasanId}:${ym}`] ?? 'pending'
  }

  function getAchievedCount(pharmacyId: string, kasanId: string): number {
    return past12Months.filter((ym) => getStatus(pharmacyId, kasanId, ym) === 'achieved').length
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'achieved': return 'bg-emerald-500'
      case 'partial': return 'bg-amber-500'
      default: return 'bg-slate-600/80'
    }
  }

  function shortKasanName(k: Kasan): string {
    if (k.code.startsWith('chiiki_iryo_')) return `地域支援${k.code.replace('chiiki_iryo_', '')}`
    if (k.code === 'zaitaku_sogo_1') return '在宅１'
    if (k.code === 'zaitaku_sogo_2') return '在宅２'
    if (k.code === 'denshi_chozai_renkei') return '電子連携'
    return k.name.slice(0, 8)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pharma-accent" />
      </div>
    )
  }

  if (pharmacies.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-heading font-bold text-pharma-text-primary mb-6">管理者画面</h1>
        <div className="bg-pharma-bg-secondary border border-pharma-warning/50 rounded-xl p-6">
          <p className="text-pharma-warning font-medium">組織・店舗の設定が必要です</p>
          <p className="text-pharma-text-secondary text-sm mt-2">
            <Link href="/dashboard/settings" className="text-pharma-accent underline hover:text-pharma-accent-secondary">設定</Link>から組織と店舗を作成してください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-pharma-text-primary">管理者画面</h1>
          <p className="text-pharma-text-muted text-sm mt-1">複数店舗の加算取得状況を一覧で確認</p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="chozai-filter" className="text-sm font-medium text-pharma-text-secondary">
            表示
          </label>
          <select
            id="chozai-filter"
            value={chozaiFilter}
            onChange={(e) => setChozaiFilter(e.target.value as ChozaiFilter)}
            className="px-4 py-2.5 bg-pharma-bg-secondary border border-pharma rounded-lg text-pharma-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-pharma-accent"
          >
            <option value="all">全店舗・全加算</option>
            <option value="1">基本料１の店舗のみ（加算1〜3）</option>
            <option value="23">基本料２・３の店舗のみ（加算1,4,5）</option>
          </select>
        </div>
      </div>

      {filteredPharmacies.length === 0 ? (
        <div className="bg-pharma-bg-secondary rounded-xl p-8 text-center border border-pharma">
          <p className="text-pharma-text-muted">該当する店舗がありません</p>
          <p className="text-sm text-pharma-text-muted mt-1">
            <Link href="/dashboard/settings" className="text-pharma-accent underline">設定</Link>で調剤基本料区分を確認してください
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-pharma bg-pharma-bg-secondary">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-pharma-bg-tertiary/80">
                <th className="text-left py-4 px-4 font-semibold text-pharma-text-primary border-b border-pharma sticky left-0 bg-pharma-bg-tertiary/80 z-10 min-w-[160px]">
                  店舗
                </th>
                {displayKasan.map((k) => (
                  <th key={k.id} className="text-left py-4 px-3 border-b border-pharma min-w-[120px]">
                    <div className="font-semibold text-pharma-text-primary text-sm">{shortKasanName(k)}</div>
                    <div className="text-xs font-normal text-pharma-text-muted mt-0.5">{k.points}点</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPharmacies.map((ph) => (
                <tr key={ph.id} className="border-b border-pharma/50 last:border-b-0 hover:bg-pharma-bg-tertiary/40 transition-colors">
                  <td className="py-4 px-4 sticky left-0 bg-pharma-bg-secondary z-10">
                    <div className="flex items-center gap-2">
                      <Link href="/dashboard/roadmap" className="font-medium text-pharma-accent hover:underline">
                        {ph.name}
                      </Link>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-pharma-bg-tertiary text-pharma-text-muted">
                        基本料{ph.chozai_kihon ?? 1}
                      </span>
                    </div>
                  </td>
                  {displayKasan.map((k) => {
                    const chozai = ph.chozai_kihon ?? 1
                    const applicable = appliesToPharmacy(k.code, chozai)
                    if (!applicable) {
                      return (
                        <td key={k.id} className="py-4 px-3 text-center text-pharma-text-muted/50 text-sm">
                          —
                        </td>
                      )
                    }
                    const achieved = getAchievedCount(ph.id, k.id)
                    const currentStatus = getStatus(ph.id, k.id, currentMonth)
                    return (
                      <td key={k.id} className="py-4 px-3">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1" title={`4月〜3月の達成状況`}>
                            {past12Months.map((ym) => (
                              <div
                                key={ym}
                                className={`w-4 h-5 rounded ${getStatusColor(getStatus(ph.id, k.id, ym))} transition-colors`}
                                title={`${ym}: ${getStatus(ph.id, k.id, ym) === 'achieved' ? '達成' : getStatus(ph.id, k.id, ym) === 'partial' ? '一部達成' : '未達'}`}
                              />
                            ))}
                          </div>
                          <span className={`text-sm font-medium tabular-nums px-2 py-1 rounded ${
                            currentStatus === 'achieved' ? 'bg-emerald-500/20 text-emerald-400' :
                            currentStatus === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-700/50 text-slate-400'
                          }`}>
                            {achieved}/12
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-6 text-sm text-pharma-text-muted">
        <span className="flex items-center gap-2">
          <span className="w-4 h-5 rounded bg-emerald-500" />
          達成
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-5 rounded bg-amber-500" />
          一部達成
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-5 rounded bg-slate-600/80" />
          未達
        </span>
      </div>
    </div>
  )
}
