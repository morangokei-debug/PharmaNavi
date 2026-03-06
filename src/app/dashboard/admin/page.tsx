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

type Pharmacy = { id: string; name: string }
type Kasan = { id: string; code: string; name: string; points: number }
type Status = { pharmacy_id: string; kasan_id: string; year_month: string; status: string }

export default function AdminPage() {
  const supabase = createClient()
  const past12Months = useMemo(() => getPast12Months(), [])
  const currentMonth = past12Months[past12Months.length - 1]

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [kasanList, setKasanList] = useState<Kasan[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
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
        .select('id, name')
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
      default: return 'bg-slate-600'
    }
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
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-pharma-text-primary">管理者画面</h1>
        <p className="text-pharma-text-muted text-sm mt-1">複数店舗の加算取得状況を一覧で確認</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-pharma-bg-secondary rounded-xl border border-pharma overflow-hidden">
          <thead>
            <tr className="bg-pharma-bg-tertiary">
              <th className="text-left p-3 text-sm font-semibold text-pharma-text-primary border-b border-pharma sticky left-0 bg-pharma-bg-tertiary z-10 min-w-[140px]">
                店舗
              </th>
              {kasanList.map((k) => (
                <th key={k.id} className="text-left p-3 text-sm font-semibold text-pharma-text-primary border-b border-pharma min-w-[180px]">
                  <div>{k.name}</div>
                  <div className="text-xs font-normal text-pharma-text-muted">{k.points}点</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pharmacies.map((ph) => (
              <tr key={ph.id} className="border-b border-pharma last:border-b-0 hover:bg-pharma-bg-tertiary/30">
                <td className="p-3 text-pharma-text-primary font-medium sticky left-0 bg-pharma-bg-secondary z-10">
                  <Link href="/dashboard/roadmap" className="text-pharma-accent hover:underline">
                    {ph.name}
                  </Link>
                </td>
                {kasanList.map((k) => {
                  const achieved = getAchievedCount(ph.id, k.id)
                  const currentStatus = getStatus(ph.id, k.id, currentMonth)
                  return (
                    <td key={k.id} className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {past12Months.map((ym) => (
                            <div
                              key={ym}
                              className={`w-3 h-4 rounded-sm ${getStatusColor(getStatus(ph.id, k.id, ym))}`}
                              title={`${ym}: ${getStatus(ph.id, k.id, ym)}`}
                            />
                          ))}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          currentStatus === 'achieved' ? 'bg-emerald-500/20 text-emerald-400' :
                          currentStatus === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-700 text-slate-400'
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

      <div className="mt-4 flex items-center gap-4 text-[10px] text-pharma-text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-4 rounded-sm bg-emerald-500 inline-block" /> 達成</span>
        <span className="flex items-center gap-1"><span className="w-3 h-4 rounded-sm bg-amber-500 inline-block" /> 一部達成</span>
        <span className="flex items-center gap-1"><span className="w-3 h-4 rounded-sm bg-slate-600 inline-block" /> 未達</span>
      </div>
    </div>
  )
}
