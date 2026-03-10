import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateKasanStatus } from './kasan-eval'

/** 処方箋1万枚当たりの実績を計算（2026年改定用） */
function computePerManMetrics(yearRecords: { item_code: string; value: number }[]): { item_code: string; value: number }[] {
  const map = new Map<string, number>()
  yearRecords.forEach((r) => {
    map.set(r.item_code, (map.get(r.item_code) ?? 0) + r.value)
  })
  const shohosen = map.get('shohosen_count') ?? 0
  const manCount = shohosen / 10000
  if (manCount <= 0) return []

  const perManMap: Record<string, string> = {
    zanryaku_yugai_count: 'zanryaku_yugai_per_man',
    kakaritsuke_count: 'kakaritsuke_per_man',
    zaitaku_visit: 'zaitaku_per_man',
    jikangai_count: 'jikangai_per_man',
    mayaku_count: 'mayaku_per_man',
    gairai_fukuyaku_count: 'gairai_fukuyaku_per_man',
    fukuyaku_info_count: 'fukuyaku_info_per_man',
    shouni_tokutei_count: 'shouni_tokutei_per_man',
  }
  const result: { item_code: string; value: number }[] = []
  for (const [rawCode, perManCode] of Object.entries(perManMap)) {
    const raw = map.get(rawCode) ?? 0
    result.push({ item_code: perManCode, value: raw / manCount })
  }
  const renkei = map.get('renkei_kaigi_count') ?? 0
  result.push({ item_code: 'renkei_kaigi_count', value: renkei })
  return result
}

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
  let yearRecords = Array.from(yearRecordsMap.entries()).map(([item_code, value]) => ({
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

  const { data: pharmacy } = await supabase
    .from('pharma_pharmacies')
    .select('chozai_kihon')
    .eq('id', pharmacyId)
    .single()
  const chozai = pharmacy?.chozai_kihon ?? 1
  if (chozai === 1) {
    approvals.push({ approval_code: 'chozai_1' })
  } else if (chozai === 2 || chozai === 3) {
    approvals.push({ approval_code: 'chozai_23' })
  }

  const revisionYear = y >= 2026 ? 2026 : 2024
  const { data: kasanList } = await supabase
    .from('pharma_kasan_master')
    .select('id, requirements_json, evaluation_type')
    .eq('revision_year', revisionYear)

  if (revisionYear === 2026) {
    const perMan = computePerManMetrics(yearRecords)
    yearRecords = [...yearRecords, ...perMan]
  }

  let updated = 0
  for (const k of kasanList ?? []) {
    // 手動加算は再計算で上書きしない（ユーザーが設定画面で算定有無を入力）
    if ((k as { evaluation_type?: string }).evaluation_type === 'manual') continue
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
