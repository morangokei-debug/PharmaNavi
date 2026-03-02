'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type ChartPoint = { month: string; label: string; achieved: number; total: number }

export function DashboardChart({ pharmacyIds }: { pharmacyIds: string[] }) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!pharmacyIds.length) {
      setLoading(false)
      return
    }
    const load = async () => {
      const now = new Date()
      const points: ChartPoint[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = `${d.getMonth() + 1}月`

        const { data: statuses } = await supabase
          .from('pharma_kasan_status')
          .select('status')
          .in('pharmacy_id', pharmacyIds)
          .eq('year_month', ym)

        const totalSlots = pharmacyIds.length * 4 // 4加算を仮定
        const achieved = statuses?.filter((s) => s.status === 'achieved').length ?? 0
        points.push({ month: ym, label, achieved, total: Math.min(totalSlots, 20) })
      }
      setData(points)
      setLoading(false)
    }
    load()
  }, [pharmacyIds.join(',')])

  if (loading || !data.length) return null

  const maxVal = Math.max(...data.map((d) => d.achieved), 1)

  return (
    <div className="bg-pharma-bg-secondary border border-pharma rounded-xl p-6 mt-8">
      <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">月別達成推移</h2>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="label"
              stroke="#718096"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            />
            <YAxis
              stroke="#718096"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              domain={[0, maxVal + 2]}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'var(--text-primary)' }}
              formatter={(value?: number) => [value ?? 0, '達成数']}
              labelFormatter={(_, payload) => payload[0]?.payload?.month && `${payload[0].payload.month}`}
            />
            <Bar dataKey="achieved" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill="var(--accent-primary)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
