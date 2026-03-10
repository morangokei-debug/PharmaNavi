/**
 * 加算未達成時の「あと何をどれくらいで取得できるか」を計算
 */

type Threshold = { value: number; period: 'month' | 'year'; operator: string }

/** 月次実績から年間合計と万枚当たりを計算（2026年改定用） */
export function computeYearRecordsWithPerMan(
  monthlyRecords: { item_code: string; year_month: string; value: number }[]
): { item_code: string; value: number }[] {
  const map = new Map<string, number>()
  monthlyRecords.forEach((r) => {
    map.set(r.item_code, (map.get(r.item_code) ?? 0) + r.value)
  })
  const result = Array.from(map.entries()).map(([item_code, value]) => ({ item_code, value }))
  const shohosen = map.get('shohosen_count') ?? 0
  const manCount = shohosen / 10000
  if (manCount > 0) {
    const perManMap: [string, string][] = [
      ['zanryaku_yugai_count', 'zanryaku_yugai_per_man'],
      ['kakaritsuke_count', 'kakaritsuke_per_man'],
      ['zaitaku_visit', 'zaitaku_per_man'],
      ['jikangai_count', 'jikangai_per_man'],
      ['mayaku_count', 'mayaku_per_man'],
      ['gairai_fukuyaku_count', 'gairai_fukuyaku_per_man'],
      ['fukuyaku_info_count', 'fukuyaku_info_per_man'],
      ['shouni_tokutei_count', 'shouni_tokutei_per_man'],
    ]
    perManMap.forEach(([raw, perMan]) => {
      const v = map.get(raw) ?? 0
      result.push({ item_code: perMan, value: v / manCount })
    })
  }
  return result
}
type ConditionItem = {
  code: string
  name: string
  type: 'approval' | 'metric'
  metric_code?: string
  threshold?: Threshold
}
type RequirementsJson = {
  condition_groups?: { id: string; logic: string; min_count?: number; items: ConditionItem[] }[]
}

type MonthlyRecord = { item_code: string; value: number }
type ApprovalRecord = { approval_code: string }

export type ShortageItem = {
  name: string
  current: number
  target: number
  unit: string
  shortage: number
  met: boolean
  message: string
}

function getValue(
  item: ConditionItem,
  records: MonthlyRecord[],
  yearRecords: MonthlyRecord[]
): number {
  const th = item.threshold
  if (!th || !item.metric_code) return 0
  const rec = th.period === 'month'
    ? records.find((r) => r.item_code === item.metric_code)
    : yearRecords.find((r) => r.item_code === item.metric_code)
  return rec?.value ?? 0
}

function isApprovalMet(item: ConditionItem, approvals: ApprovalRecord[]): boolean {
  return approvals.some((a) => a.approval_code === item.code)
}

export function getShortageForKasan(
  requirements: RequirementsJson | null,
  records: MonthlyRecord[],
  yearMonth: string,
  yearRecords: MonthlyRecord[],
  approvals: ApprovalRecord[] = []
): ShortageItem[] {
  if (!requirements?.condition_groups?.length) return []

  const items: ShortageItem[] = []
  for (const group of requirements.condition_groups) {
    for (const item of group.items) {
      if (item.type === 'approval') {
        const met = isApprovalMet(item, approvals)
        items.push({
          name: item.name,
          current: met ? 1 : 0,
          target: 1,
          unit: '届出',
          shortage: met ? 0 : 1,
          met,
          message: met ? '届出済み' : '届出が必要です',
        })
        continue
      }

      if (item.type === 'metric' && item.threshold && item.metric_code) {
        const th = item.threshold
        const current = getValue(item, records, yearRecords)
        const target = th.value
        const unit = th.period === 'year' && item.metric_code.includes('per_man')
          ? '回/万枚'
          : th.period === 'year'
            ? '回/年'
            : '%'
        const shortage = th.operator === '>=' ? Math.max(0, target - current) : 0
        const met = th.operator === '>=' ? current >= target : current > target

        let message: string
        const currInt = Math.round(current)
        const shortInt = Math.round(shortage)
        if (met) {
          message = `達成（${currInt}${unit}）`
        } else if (shortage > 0) {
          message = `あと${shortInt}${unit}（現在${currInt}）`
        } else {
          message = `未達成（現在${currInt}${unit}）`
        }

        items.push({
          name: item.name,
          current,
          target,
          unit,
          shortage,
          met,
          message,
        })
      }
    }
  }
  return items
}
