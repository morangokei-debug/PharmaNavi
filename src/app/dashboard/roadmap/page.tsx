'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { computeYearRecordsWithPerMan, getShortageForKasan } from '@/lib/kasan-shortage'

function getPast12Months(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }
  return months
}

function shortMonth(ym: string): string {
  const [, m] = ym.split('-')
  return `${parseInt(m)}月`
}

type Pharmacy = { id: string; name: string }
type KasanMaster = {
  id: string
  code: string
  name: string
  points: number
  requirements_json: RequirementsJson | null
}
type KasanStatus = {
  kasan_id: string
  year_month: string
  status: 'achieved' | 'partial' | 'pending' | 'not_applicable'
  achievement_rate: number
}

type Threshold = { value: number; period: 'month' | 'year'; operator: string }
type ConditionItem = {
  code: string
  name: string
  type: 'approval' | 'metric'
  metric_code?: string
  threshold?: Threshold
}
type ConditionGroup = {
  id: string
  logic: 'AND' | 'OR'
  min_count?: number
  items: ConditionItem[]
}
type RequirementsJson = {
  condition_groups?: ConditionGroup[]
}

type MonthlyRecord = {
  item_code: string
  year_month: string
  value: number
}

const STORAGE_KEY = 'pharmanavi-roadmap-pharmacy'

/** 調剤基本料区分に応じて算定可能な地域支援加算のみに絞る */
function filterKasanByChozai(list: KasanMaster[], chozai: number): KasanMaster[] {
  return list.filter((k) => {
    if (k.code.startsWith('chiiki_iryo_')) {
      if (k.code === 'chiiki_iryo_1') return true
      if (k.code === 'chiiki_iryo_2' || k.code === 'chiiki_iryo_3') return chozai === 1
      if (k.code === 'chiiki_iryo_4' || k.code === 'chiiki_iryo_5') return chozai === 2 || chozai === 3
    }
    return true
  })
}

export default function RoadmapPage() {
  const supabase = createClient()
  const past12Months = useMemo(() => getPast12Months(), [])
  const currentMonth = past12Months[past12Months.length - 1]

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [selectedPharmacy, setSelectedPharmacyRaw] = useState('')
  const [kasanList, setKasanList] = useState<KasanMaster[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, Record<string, KasanStatus>>>({})
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([])
  const [approvals, setApprovals] = useState<string[]>([])
  const [chozaiKihon, setChozaiKihon] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  function setSelectedPharmacy(id: string) {
    setSelectedPharmacyRaw(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('pharma_profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) { setLoading(false); return }

      const { data: ph } = await supabase
        .from('pharma_pharmacies')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
        .order('name')
      const list = ph ?? []
      setPharmacies(list)

      let restored = ''
      try { restored = localStorage.getItem(STORAGE_KEY) ?? '' } catch {}
      const valid = list.find((p) => p.id === restored)
      const initial = valid ? restored : list[0]?.id ?? ''
      setSelectedPharmacyRaw(initial)
      if (initial) try { localStorage.setItem(STORAGE_KEY, initial) } catch {}

      const { data: kasan } = await supabase
        .from('pharma_kasan_master')
        .select('id, code, name, points, requirements_json')
        .eq('revision_year', 2026)
        .order('code')
      setKasanList(kasan ?? [])

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedPharmacy) return
    async function loadStatus() {
      const { data: statuses } = await supabase
        .from('pharma_kasan_status')
        .select('kasan_id, year_month, status, achievement_rate')
        .eq('pharmacy_id', selectedPharmacy)
        .in('year_month', past12Months)

      const map: Record<string, Record<string, KasanStatus>> = {}
      statuses?.forEach((s) => {
        if (!map[s.kasan_id]) map[s.kasan_id] = {}
        map[s.kasan_id][s.year_month] = s as KasanStatus
      })
      setStatusMap(map)

      const { data: records } = await supabase
        .from('pharma_monthly_records')
        .select('item_code, year_month, value')
        .eq('pharmacy_id', selectedPharmacy)
        .in('year_month', past12Months)
      setMonthlyRecords((records ?? []).map(r => ({
        item_code: r.item_code,
        year_month: r.year_month,
        value: Number(r.value),
      })))

      const { data: approvalRows } = await supabase
        .from('pharma_pharmacy_approvals')
        .select('approval_code')
        .eq('pharmacy_id', selectedPharmacy)
        .not('approved_at', 'is', null)
      setApprovals((approvalRows ?? []).map(r => r.approval_code))

      const { data: ph } = await supabase
        .from('pharma_pharmacies')
        .select('chozai_kihon')
        .eq('id', selectedPharmacy)
        .single()
      setChozaiKihon(ph?.chozai_kihon ?? 1)
    }
    loadStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPharmacy])

  const yearTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    monthlyRecords.forEach(r => {
      totals[r.item_code] = (totals[r.item_code] ?? 0) + r.value
    })
    return totals
  }, [monthlyRecords])

  const yearRecordsWithPerMan = useMemo(() => computeYearRecordsWithPerMan(monthlyRecords), [monthlyRecords])

  const effectiveApprovals = useMemo(() => {
    const list = approvals.map((c) => ({ approval_code: c }))
    if (chozaiKihon === 1) list.push({ approval_code: 'chozai_1' })
    else if (chozaiKihon === 2 || chozaiKihon === 3) list.push({ approval_code: 'chozai_23' })
    return list
  }, [approvals, chozaiKihon])

  const displayKasanList = useMemo(
    () => filterKasanByChozai(kasanList, chozaiKihon),
    [kasanList, chozaiKihon]
  )

  function getMonthValue(metricCode: string, ym: string): number {
    return monthlyRecords
      .filter(r => r.item_code === metricCode && r.year_month === ym)
      .reduce((sum, r) => sum + r.value, 0)
  }

  function getYearValue(metricCode: string): number {
    const r = yearRecordsWithPerMan.find((x) => x.item_code === metricCode)
    return r?.value ?? yearTotals[metricCode] ?? 0
  }

  function getStatusColor(status: string | undefined) {
    switch (status) {
      case 'achieved': return 'bg-emerald-500'
      case 'partial': return 'bg-amber-500'
      default: return 'bg-slate-600'
    }
  }

  function getStatusBadge(status: string | undefined) {
    switch (status) {
      case 'achieved': return { text: '達成', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' }
      case 'partial': return { text: '一部達成', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' }
      default: return { text: '未達', cls: 'bg-slate-700 text-slate-400 border-slate-600' }
    }
  }

  function getAchievedCount(kasanId: string): number {
    const months = statusMap[kasanId] ?? {}
    return Object.values(months).filter(s => s.status === 'achieved').length
  }

  function renderConditionProgress(kasan: KasanMaster) {
    const req = kasan.requirements_json
    if (!req?.condition_groups?.length) return null

    return (
      <div className="mt-4 space-y-3">
        {req.condition_groups.map((group) => (
          <div key={group.id} className="space-y-1.5">
            {group.items.map((item) => {
              if (item.type === 'approval') {
                const ok = approvals.includes(item.code)
                return (
                  <div key={item.code} className="flex items-center gap-2 text-sm">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                      {ok ? '✓' : '−'}
                    </span>
                    <span className={ok ? 'text-pharma-text-primary' : 'text-pharma-text-muted'}>
                      {item.name}
                    </span>
                    <span className="text-xs text-pharma-text-muted ml-auto">
                      {ok ? '届出済み' : '未届出'}
                    </span>
                  </div>
                )
              }

              if (item.type === 'metric' && item.threshold && item.metric_code) {
                const th = item.threshold
                const isYear = th.period === 'year'
                const currentVal = isYear
                  ? getYearValue(item.metric_code)
                  : getMonthValue(item.metric_code, currentMonth)
                const target = th.value
                const rate = target > 0 ? Math.min(currentVal / target, 1) : 0
                const met = th.operator === '>=' ? currentVal >= target : currentVal > target

                return (
                  <div key={item.code} className="text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                          {met ? '✓' : '−'}
                        </span>
                        <span className={met ? 'text-pharma-text-primary' : 'text-pharma-text-muted'}>
                          {item.name}
                        </span>
                      </div>
                      <span className="text-xs font-mono tabular-nums">
                        <span className={met ? 'text-emerald-400' : 'text-pharma-text-secondary'}>{Math.round(currentVal)}</span>
                        <span className="text-pharma-text-muted"> / {target}</span>
                      </span>
                    </div>
                    <div className="ml-7 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${met ? 'bg-emerald-500' : rate > 0.5 ? 'bg-amber-500' : 'bg-slate-500'}`}
                        style={{ width: `${rate * 100}%` }}
                      />
                    </div>
                  </div>
                )
              }

              return null
            })}
          </div>
        ))}
      </div>
    )
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
        <h1 className="text-2xl font-heading font-bold text-pharma-text-primary mb-6">加算ロードマップ</h1>
        <div className="bg-pharma-bg-secondary border border-pharma-warning/50 rounded-xl p-6">
          <p className="text-pharma-warning font-medium">組織・店舗の設定が必要です</p>
          <p className="text-pharma-text-secondary text-sm mt-2">
            <Link href="/dashboard/settings" className="text-pharma-accent underline hover:text-pharma-accent-secondary">設定</Link>から組織と店舗を作成してください。
          </p>
        </div>
      </div>
    )
  }

  const currentPharmacyName = pharmacies.find((p) => p.id === selectedPharmacy)?.name ?? ''

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-pharma-text-primary">加算ロードマップ</h1>
          <p className="text-pharma-text-muted text-sm mt-1">過去12ヶ月の達成推移とリアルタイム進捗</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-pharma-text-muted">店舗:</span>
          {pharmacies.length === 1 ? (
            <span className="px-3 py-2 bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary font-medium">
              {currentPharmacyName}
            </span>
          ) : (
            <select
              value={selectedPharmacy}
              onChange={(e) => setSelectedPharmacy(e.target.value)}
              className="bg-pharma-bg-secondary border border-pharma rounded-lg px-3 py-2 text-pharma-text-primary text-sm min-w-[180px]"
              aria-label="表示する店舗を選択"
            >
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {displayKasanList.length === 0 ? (
        <div className="bg-pharma-bg-secondary rounded-xl p-12 text-center">
          {kasanList.length === 0 ? (
            <>
              <p className="text-pharma-text-muted text-lg mb-2">加算マスタが登録されていません</p>
              <p className="text-pharma-text-muted text-sm">SQL Editorでシードデータを投入してください。</p>
            </>
          ) : (
            <>
              <p className="text-pharma-text-muted text-lg mb-2">表示する加算がありません</p>
              <p className="text-pharma-text-muted text-sm">
                <Link href="/dashboard/settings" className="text-pharma-accent underline">設定</Link>で店舗の調剤基本料区分（1・2・3）を確認してください。
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {displayKasanList.map((kasan) => {
            const currentStatus = statusMap[kasan.id]?.[currentMonth]?.status
            const badge = getStatusBadge(currentStatus)
            const achievedCount = getAchievedCount(kasan.id)

            return (
              <div
                key={kasan.id}
                className="bg-pharma-bg-secondary rounded-xl border border-pharma overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-pharma-text-primary text-lg">{kasan.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-pharma-text-muted">{kasan.points}点</span>
                        <span className="text-xs text-pharma-text-muted">
                          達成月: <span className="font-mono text-pharma-text-secondary">{achievedCount}</span> / 12
                        </span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>

                  {/* 12-month timeline */}
                  <div className="mb-2">
                    <div className="grid grid-cols-12 gap-1">
                      {past12Months.map((ym) => {
                        const s = statusMap[kasan.id]?.[ym]
                        return (
                          <div key={ym} className="text-center">
                            <div className="text-[10px] text-pharma-text-muted mb-1">{shortMonth(ym)}</div>
                            <div
                              className={`h-6 rounded ${getStatusColor(s?.status)} transition-colors`}
                              title={`${ym}: ${s?.status === 'achieved' ? '達成' : s?.status === 'partial' ? '一部達成' : '未達'}`}
                            />
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-pharma-text-muted">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> 達成</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> 一部達成</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-600 inline-block" /> 未達</span>
                    </div>
                  </div>

                  {/* Condition progress */}
                  {renderConditionProgress(kasan)}

                  {/* 未達成時: あと何をどれくらいで取得できるか */}
                  {currentStatus !== 'achieved' && kasan.requirements_json && (() => {
                    const monthRecords = monthlyRecords
                      .filter((r) => r.year_month === currentMonth)
                      .map((r) => ({ item_code: r.item_code, value: r.value }))
                    const shortages = getShortageForKasan(
                      kasan.requirements_json,
                      monthRecords,
                      currentMonth,
                      yearRecordsWithPerMan,
                      effectiveApprovals
                    ).filter((s) => !s.met)
                    return shortages.length > 0 ? (
                      <div className="mt-6 pt-4 border-t border-pharma">
                        <p className="text-sm font-medium text-pharma-text-primary mb-3">取得に向けた不足分</p>
                        <ul className="space-y-2">
                          {shortages.map((s, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-amber-400">⚠</span>
                              <span className="text-pharma-text-secondary">{s.name}:</span>
                              <span className="text-pharma-text-primary font-medium">{s.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-6 pt-4 border-t border-pharma">
                        <p className="text-sm text-pharma-text-muted">一部達成中。届出や施設基準の確認が必要です。</p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
