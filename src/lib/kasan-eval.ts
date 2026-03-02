/**
 * 月次実績・届出状況から加算達成状況を自動判定
 */

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

type MonthlyRecord = { item_code: string; value: number }
type ApprovalRecord = { approval_code: string }

function evalApproval(item: ConditionItem, approvals: ApprovalRecord[]): boolean {
  return approvals.some((a) => a.approval_code === item.code)
}

function evalMetric(
  item: ConditionItem,
  records: MonthlyRecord[],
  yearMonth: string,
  yearRecords: MonthlyRecord[]
): boolean {
  const th = item.threshold
  if (!th || !item.metric_code) return false

  const rec = th.period === 'month'
    ? records.find((r) => r.item_code === item.metric_code)
    : yearRecords.find((r) => r.item_code === item.metric_code)
  const val = rec?.value ?? 0

  if (th.operator === '>=') return val >= th.value
  if (th.operator === '>') return val > th.value
  if (th.operator === '<=') return val <= th.value
  if (th.operator === '<') return val < th.value
  return false
}

function evalGroup(
  group: ConditionGroup,
  records: MonthlyRecord[],
  yearMonth: string,
  yearRecords: MonthlyRecord[],
  approvals: ApprovalRecord[]
): boolean {
  const metricItems = group.items.filter((i) => i.type === 'metric')
  const approvalItems = group.items.filter((i) => i.type === 'approval')

  const metricOk = group.logic === 'AND'
    ? metricItems.every((i) => evalMetric(i, records, yearMonth, yearRecords))
    : metricItems.filter((i) => evalMetric(i, records, yearMonth, yearRecords)).length >= (group.min_count ?? 1)
  const approvalOk = approvalItems.length === 0 || approvalItems.every((i) => evalApproval(i, approvals))

  if (group.logic === 'AND') {
    return metricOk && approvalOk
  }
  return metricOk && approvalOk
}

export function evaluateKasanStatus(
  requirements: RequirementsJson | null,
  records: MonthlyRecord[],
  yearMonth: string,
  yearRecords: MonthlyRecord[],
  approvals: ApprovalRecord[] = []
): { status: 'achieved' | 'partial' | 'pending' | 'not_applicable'; rate: number } {
  if (!requirements?.condition_groups?.length) {
    return { status: 'pending', rate: 0 }
  }

  const groups = requirements.condition_groups
  const evaluableGroups = groups.filter(
    (g) => g.items.some((i) => i.type === 'metric') || g.items.some((i) => i.type === 'approval')
  )
  if (evaluableGroups.length === 0) {
    return { status: 'not_applicable', rate: 0 }
  }

  const passed = evaluableGroups.filter((g) =>
    evalGroup(g, records, yearMonth, yearRecords, approvals)
  ).length
  const total = evaluableGroups.length
  const rate = total > 0 ? passed / total : 0

  if (rate >= 1) return { status: 'achieved', rate: 1 }
  if (rate > 0) return { status: 'partial', rate }
  return { status: 'pending', rate: 0 }
}
