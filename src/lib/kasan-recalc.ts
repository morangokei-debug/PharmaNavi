import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateKasanStatus } from './kasan-eval'

export async function recalculateKasanStatus(
  supabase: SupabaseClient,
  pharmacyId: string,
  yearMonth: string
): Promise<number> {
  const [y] = yearMonth.split('-').map(Number)
  const yearStart = `${y}-01`
  const yearEnd = `${y}-12`

  const { data: monthRecords } = await supabase
    .from('pharma_monthly_records')
    .select('item_code, value')
    .eq('pharmacy_id', pharmacyId)
    .eq('year_month', yearMonth)

  const { data: yearRecordsRaw } = await supabase
    .from('pharma_monthly_records')
    .select('item_code, value')
    .eq('pharmacy_id', pharmacyId)
    .gte('year_month', yearStart)
    .lte('year_month', yearEnd)

  const yearRecordsMap = new Map<string, number>()
  yearRecordsRaw?.forEach((r) => {
    const cur = yearRecordsMap.get(r.item_code) ?? 0
    yearRecordsMap.set(r.item_code, cur + Number(r.value))
  })
  const yearRecords = Array.from(yearRecordsMap.entries()).map(([item_code, value]) => ({
    item_code,
    value,
  }))

  const records = (monthRecords ?? []).map((r) => ({
    item_code: r.item_code,
    value: Number(r.value),
  }))

  const { data: approvalRows } = await supabase
    .from('pharma_pharmacy_approvals')
    .select('approval_code')
    .eq('pharmacy_id', pharmacyId)
    .not('approved_at', 'is', null)
  const approvals = (approvalRows ?? []).map((r) => ({ approval_code: r.approval_code }))

  const { data: kasanList } = await supabase
    .from('pharma_kasan_master')
    .select('id, requirements_json')
    .eq('revision_year', y)

  let updated = 0
  for (const k of kasanList ?? []) {
    const req = k.requirements_json as Parameters<typeof evaluateKasanStatus>[0]
    const { status, rate } = evaluateKasanStatus(req, records, yearMonth, yearRecords, approvals)

    const { error } = await supabase
      .from('pharma_kasan_status')
      .upsert(
        {
          pharmacy_id: pharmacyId,
          kasan_id: k.id,
          year_month: yearMonth,
          status,
          achievement_rate: rate,
        },
        { onConflict: 'pharmacy_id,kasan_id,year_month' }
      )

    if (!error) updated++
  }
  return updated
}
