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
      case 'partial': return 'bg-amber-400'
      default: return 'bg-slate-300'
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'achieved': return '達成'
      case 'partial': return '一部'
      default: return '未達'
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
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-pharma-accent/30 border-t-pharma-accent rounded-full animate-spin" />
          <p className="text-pharma-text-muted text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (pharmacies.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-heading font-bold text-pharma-text-primary mb-6">管理者画面</h1>
        <div className="bg-pharma-bg-secondary border-2 border-amber-400/50 rounded-2xl p-8 shadow-lg">
          <p className="text-amber-600 font-semibold">組織・店舗の設定が必要です</p>
          <p className="text-pharma-text-secondary text-sm mt-2">
            <Link href="/dashboard/settings" className="text-pharma-accent underline hover:text-pharma-accent-secondary font-medium">設定</Link>から組織と店舗を作成してください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-pharma-text-primary tracking-tight">管理者画面</h1>
          <p className="text-pharma-text-muted text-sm mt-1">複数店舗の加算取得状況を一覧で確認</p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="chozai-filter" className="text-sm font-medium text-pharma-text-secondary">
            表示フィルタ
          </label>
          <select
            id="chozai-filter"
            value={chozaiFilter}
            onChange={(e) => setChozaiFilter(e.target.value as ChozaiFilter)}
            className="px-4 py-2.5 bg-pharma-bg-secondary border border-pharma rounded-xl text-pharma-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pharma-accent shadow-sm"
          >
            <option value="all">全店舗・全加算</option>
            <option value="1">基本料１の店舗（加算1〜3）</option>
            <option value="23">基本料２・３の店舗（加算1,4,5）</option>
          </select>
        </div>
      </div>

      {/* 凡例：目立つ位置に */}
      <div className="mb-6 p-4 bg-pharma-bg-secondary rounded-xl border border-pharma flex flex-wrap items-center gap-6 shadow-sm">
        <span className="text-sm font-medium text-pharma-text-secondary">凡例：</span>
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-emerald-500 shadow-sm" />
          <span className="text-sm text-pharma-text-primary">達成</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-amber-400 shadow-sm" />
          <span className="text-sm text-pharma-text-primary">一部達成</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-slate-300 shadow-sm" />
          <span className="text-sm text-pharma-text-primary">未達</span>
        </span>
        <span className="text-sm text-pharma-text-muted ml-auto">
          各マスは過去12ヶ月（4月〜翌3月）の月別達成状況です
        </span>
      </div>

      {filteredPharmacies.length === 0 ? (
        <div className="bg-pharma-bg-secondary rounded-2xl p-12 text-center border border-pharma shadow-sm">
          <p className="text-pharma-text-muted font-medium">該当する店舗がありません</p>
          <p className="text-sm text-pharma-text-muted mt-2">
            <Link href="/dashboard/settings" className="text-pharma-accent underline">設定</Link>で調剤基本料区分を確認してください
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-pharma bg-pharma-bg-secondary shadow-lg">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left py-4 px-5 font-semibold text-pharma-text-primary border-b-2 border-pharma sticky left-0 bg-slate-100 z-10 min-w-[180px]">
                  店舗
                </th>
                {displayKasan.map((k) => (
                  <th key={k.id} className="text-left py-4 px-4 border-b-2 border-pharma min-w-[140px]">
                    <div className="font-semibold text-pharma-text-primary">{shortKasanName(k)}</div>
                    <div className="text-xs font-normal text-pharma-text-muted mt-0.5">{k.points}点</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPharmacies.map((ph, rowIdx) => (
                <tr
                  key={ph.id}
                  className={`border-b border-pharma/60 last:border-b-0 hover:bg-pharma-bg-tertiary/80 transition-colors admin-row ${
                    rowIdx % 2 === 0 ? 'bg-pharma-bg-secondary' : 'bg-white'
                  }`}
                >
                  <td className="py-4 px-5 sticky left-0 z-10 bg-inherit">
                    <div className="flex flex-col gap-1">
                      <Link href="/dashboard/roadmap" className="font-semibold text-pharma-accent hover:text-pharma-accent-secondary hover:underline">
                        {ph.name}
                      </Link>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-pharma-bg-tertiary text-pharma-text-muted inline-flex w-fit">
                        調剤基本料{ph.chozai_kihon ?? 1}
                      </span>
                    </div>
                  </td>
                  {displayKasan.map((k) => {
                    const chozai = ph.chozai_kihon ?? 1
                    const applicable = appliesToPharmacy(k.code, chozai)
                    if (!applicable) {
                      return (
                        <td key={k.id} className="py-4 px-4 text-center text-pharma-text-muted/60 text-sm">
                          —
                        </td>
                      )
                    }
                    const achieved = getAchievedCount(ph.id, k.id)
                    const currentStatus = getStatus(ph.id, k.id, currentMonth)
                    return (
                      <td key={k.id} className="py-4 px-4">
                        <div className="flex flex-col gap-2">
                          {/* 12ヶ月タイムライン（大きく） */}
                          <div className="flex gap-1" title="4月〜翌3月の月別達成状況">
                            {past12Months.map((ym) => {
                              const st = getStatus(ph.id, k.id, ym)
                              return (
                                <div
                                  key={ym}
                                  className={`w-6 h-6 rounded-md ${getStatusColor(st)} transition-colors flex-shrink-0`}
                                  title={`${ym}: ${getStatusLabel(st)}`}
                                />
                              )
                            })}
                          </div>
                          {/* 達成数：明確なラベル */}
                          <div className={`text-sm font-semibold tabular-nums px-2 py-1 rounded-lg inline-flex w-fit ${
                            currentStatus === 'achieved' ? 'bg-emerald-100 text-emerald-700' :
                            currentStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            達成 {achieved}/12ヶ月
                          </div>
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
    </div>
  )
}
