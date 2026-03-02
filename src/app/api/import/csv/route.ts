import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { COLUMN_TO_ITEM, IGNORE_COLUMNS, AVERAGE_ITEMS } from '@/lib/csv-mapping'
import { recalculateKasanStatus } from '@/lib/kasan-recalc'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_ROWS = 100000

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(parseCSVLine)
  return { headers, rows }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if ((c === ',' && !inQuotes) || c === '\t') {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

function aggregateRows(rows: string[][], headers: string[], colToItem: Map<number, string>): Record<string, number> {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const row of rows) {
    colToItem.forEach((itemCode, colIdx) => {
      const val = row[colIdx]?.replace(/,/g, '')?.trim()
      const num = val ? parseFloat(val) : 0
      if (!isNaN(num)) {
        sums[itemCode] = (sums[itemCode] ?? 0) + num
        counts[itemCode] = (counts[itemCode] ?? 0) + 1
      }
    })
  }
  const result = { ...sums }
  AVERAGE_ITEMS.forEach((code) => {
    if (counts[code] && counts[code] > 0) {
      result[code] = Math.round((sums[code] / counts[code]) * 100) / 100
    }
  })
  return result
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const pharmacyId = formData.get('pharmacy_id') as string | null
    const yearMonth = formData.get('year_month') as string | null

    if (!file || !pharmacyId || !yearMonth) {
      return NextResponse.json({ error: 'ファイル・店舗・対象月を指定してください' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: '.csv ファイルのみ対応しています' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 })
    }

    const buf = await file.arrayBuffer()
    const decoder = new TextDecoder('utf-8')
    let text = decoder.decode(buf)
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // BOM除去

    const { headers, rows } = parseCSV(text)
    if (headers.length === 0) {
      return NextResponse.json({ error: 'CSVのヘッダー行を読み取れませんでした' }, { status: 400 })
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `行数は${MAX_ROWS}行以下にしてください` }, { status: 400 })
    }

    const colToItem = new Map<number, string>()
    headers.forEach((h, i) => {
      const key = h.trim()
      if (IGNORE_COLUMNS.has(key)) return
      const itemCode = COLUMN_TO_ITEM[key] ?? COLUMN_TO_ITEM[key.toLowerCase()]
      if (itemCode) colToItem.set(i, itemCode)
    })

    if (colToItem.size === 0) {
      return NextResponse.json({
        error: 'マッピングできる列がありません。列名を確認してください。',
        headers: headers.slice(0, 20),
      }, { status: 400 })
    }

    const sums = aggregateRows(rows, headers, colToItem)

    const { data: profile } = await supabase
      .from('pharma_profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const { data: ph } = await supabase
      .from('pharma_pharmacies')
      .select('id')
      .eq('id', pharmacyId)
      .eq('organization_id', profile?.organization_id ?? '')
      .single()

    if (!ph) {
      return NextResponse.json({ error: '指定した店舗にアクセスできません' }, { status: 403 })
    }

    const records = Object.entries(sums).map(([item_code, value]) => ({
      pharmacy_id: pharmacyId,
      year_month: yearMonth,
      item_code,
      value,
    }))

    for (const r of records) {
      const { error } = await supabase
        .from('pharma_monthly_records')
        .upsert(r, { onConflict: 'pharmacy_id,year_month,item_code' })
      if (error) {
        return NextResponse.json({ error: '保存に失敗しました: ' + error.message }, { status: 500 })
      }
    }

    await supabase.from('pharma_csv_import_logs').insert({
      pharmacy_id: pharmacyId,
      user_id: user.id,
      file_name: file.name,
      row_count: rows.length,
    })

    await recalculateKasanStatus(supabase, pharmacyId, yearMonth)

    return NextResponse.json({
      success: true,
      imported: records.length,
      row_count: rows.length,
      items: records.map((r) => ({ code: r.item_code, value: r.value })),
    })
  } catch (e) {
    console.error('CSV import error:', e)
    return NextResponse.json({ error: '取り込み中にエラーが発生しました' }, { status: 500 })
  }
}
