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

function formatThreshold(th: Threshold): string {
  const period = th.period === 'month' ? '月' : '年'
  if (th.operator === '>=') return `${period}${th.value}件以上`
  if (th.operator === '>') return `${period}${th.value}件超`
  if (th.operator === '<=') return `${period}${th.value}件以下`
  return `${period}${th.value}件未満`
}

function formatItem(item: ConditionItem): string {
  if (item.type === 'approval') return item.name
  if (item.type === 'metric' && item.threshold) {
    return `${item.name} ${formatThreshold(item.threshold)}`
  }
  return item.name
}

export function formatRequirementsJson(json: unknown): string[] {
  const req = json as RequirementsJson | null
  if (!req?.condition_groups?.length) return []

  const lines: string[] = []
  for (const g of req.condition_groups) {
    const logic = g.logic === 'AND' ? 'かつ' : 'または'
    const parts = g.items.map(formatItem)
    if (g.min_count && g.logic === 'OR') {
      lines.push(`${parts.join(` ${logic} `)} のうち${g.min_count}つ以上`)
    } else {
      lines.push(parts.join(` ${logic} `))
    }
  }
  return lines
}
