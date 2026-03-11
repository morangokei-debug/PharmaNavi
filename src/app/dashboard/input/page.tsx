'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

/** 直近12ヶ月の年月リスト（古い順） */
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

type Pharmacy = { id: string; name: string }
type Item = { code: string; name: string; unit: string }
type ImportLog = {
  id: string
  file_name: string
  row_count: number | null
  imported_at: string
  pharmacy_name: string
}

const STORAGE_KEY = 'pharmanavi-input-pharmacy'
const DRAFT_STORAGE_KEY = 'pharmanavi-input-draft'

/** DBの値を表示用に整形（59.0→59、59.4→59.4） */
function formatValueForDisplay(val: unknown): string {
  if (val === '' || val == null) return ''
  const n = Number(val)
  if (Number.isNaN(n)) return String(val)
  if (Number.isInteger(n)) return String(Math.round(n))
  return String(val)
}

/** 項目をカテゴリ別にグループ化（手入力時の視認性向上） */
const ITEM_GROUPS: Record<string, string[]> = {
  '処方箋・基本': ['shohosen_count', 'kohatsu_ratio', 'mynumber_confirm_pct', 'denshi_count', 'chofuku_count'],
  '在宅・訪問': ['zaitaku_visit', 'zaitaku_visit_kojinka'],
  '服薬支援': ['fukuyaku_follow', 'gairai_fukuyaku_count', 'fukuyaku_info_count'],
  '加算関連': ['mayaku_count', 'kakaritsuke_count', 'zanryaku_yugai_count', 'jikangai_count'],
  'その他': ['shouni_tokutei_count', 'renkei_kaigi_count'],
}

function groupItems(items: Item[]): { group: string; items: Item[] }[] {
  const byCode = Object.fromEntries(items.map((i) => [i.code, i]))
  const result: { group: string; items: Item[] }[] = []
  const used = new Set<string>()

  for (const [groupName, codes] of Object.entries(ITEM_GROUPS)) {
    const groupItemsList = codes
      .map((c) => byCode[c])
      .filter(Boolean) as Item[]
    if (groupItemsList.length) {
      groupItemsList.forEach((i) => used.add(i.code))
      result.push({ group: groupName, items: groupItemsList })
    }
  }
  const rest = items.filter((i) => !used.has(i.code))
  if (rest.length) {
    const otherIdx = result.findIndex((r) => r.group === 'その他')
    if (otherIdx >= 0) {
      result[otherIdx].items = [...result[otherIdx].items, ...rest]
    } else {
      result.push({ group: 'その他', items: rest })
    }
  }
  return result
}

export default function InputPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedPharmacy, setSelectedPharmacyRaw] = useState('')
  const [values, setValues] = useState<Record<string, Record<string, string>>>({})

  const setSelectedPharmacy = (id: string) => {
    setSelectedPharmacyRaw(id)
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, id) } catch {}
    }
  }
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvImportTargetMonth, setCsvImportTargetMonth] = useState('')
  const [csvImporting, setCsvImporting] = useState(false)
  const [importLogs, setImportLogs] = useState<ImportLog[]>([])
  const [csvOpen, setCsvOpen] = useState(false)
  const supabase = createClient()
  const formRef = useRef<HTMLFormElement>(null)

  const past12Months = useMemo(() => getPast12Months(), [])
  const groupedItems = useMemo(() => groupItems(items), [items])

  useEffect(() => {
    const load = async () => {
      const { data: phData } = await supabase
        .from('pharma_pharmacies')
        .select('id, name')
        .order('name')
      if (phData) {
        setPharmacies(phData)
        if (typeof window !== 'undefined') {
          try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved && phData.some((p) => p.id === saved)) {
              setSelectedPharmacyRaw(saved)
            }
          } catch {}
        }
      }

      const { data: itemData } = await supabase
        .from('pharma_item_master')
        .select('code, name, unit')
        .order('code')
      if (itemData) setItems(itemData)

      const now = new Date()
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setCsvImportTargetMonth(currentYm)

      if (phData?.length) {
        const phIds = phData.map((p) => p.id)
        const { data: logs } = await supabase
          .from('pharma_csv_import_logs')
          .select('id, file_name, row_count, imported_at, pharmacy_id')
          .in('pharmacy_id', phIds)
          .order('imported_at', { ascending: false })
          .limit(10)
        if (logs) {
          const phMap: Record<string, string> = {}
          phData.forEach((p) => { phMap[p.id] = p.name })
          setImportLogs(logs.map((l) => ({
            id: l.id,
            file_name: l.file_name,
            row_count: l.row_count,
            imported_at: l.imported_at,
            pharmacy_name: phMap[l.pharmacy_id] ?? '-',
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedPharmacy || past12Months.length === 0) {
      setRecordsLoading(false)
      return
    }
    let cancelled = false
    setRecordsLoading(true)
    const load = async () => {
      const { data } = await supabase
        .from('pharma_monthly_records')
        .select('year_month, item_code, value')
        .eq('pharmacy_id', selectedPharmacy)
        .in('year_month', past12Months)
      if (cancelled) return
      const v: Record<string, Record<string, string>> = {}
      past12Months.forEach((ym) => { v[ym] = {} })
      data?.forEach((r) => {
        if (!v[r.year_month]) v[r.year_month] = {}
        v[r.year_month][r.item_code] = formatValueForDisplay(r.value)
      })
      let restoredDraft = false
      if (typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY)
          if (raw) {
            const draft = JSON.parse(raw) as { pharmacy_id: string; values: Record<string, Record<string, string>> }
            if (draft.pharmacy_id === selectedPharmacy && draft.values) {
              past12Months.forEach((ym) => {
                v[ym] = { ...(v[ym] ?? {}), ...(draft.values[ym] ?? {}) }
              })
              restoredDraft = true
            }
          }
        } catch {}
      }
      setValues(v)
      setRecordsLoading(false)
      if (restoredDraft && !cancelled) {
        setMessage('保存していない入力が復元されました。保存ボタンで確定してください。')
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedPharmacy, past12Months])

  useEffect(() => {
    if (!selectedPharmacy || Object.keys(values).length === 0) return
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
        pharmacy_id: selectedPharmacy,
        values,
        updated_at: new Date().toISOString(),
      }))
    } catch {}
  }, [selectedPharmacy, values])

  const handleSave = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!selectedPharmacy) return
    setSaving(true)
    setMessage(null)

    for (const ym of past12Months) {
      for (const item of items) {
        const val = values[ym]?.[item.code]?.trim()
        const num = val ? parseFloat(val) : 0
        const { error } = await supabase
          .from('pharma_monthly_records')
          .upsert(
            { pharmacy_id: selectedPharmacy, year_month: ym, item_code: item.code, value: num },
            { onConflict: 'pharmacy_id,year_month,item_code' }
          )
        if (error) {
          setMessage('保存に失敗しました: ' + error.message)
          setSaving(false)
          return
        }
      }
    }
    for (const ym of past12Months) {
      await fetch('/api/kasan/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacy_id: selectedPharmacy, year_month: ym }),
      }).catch(() => {})
    }
    setMessage('保存しました（過去12ヶ月分）')
    setSaving(false)
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {}
  }, [selectedPharmacy, past12Months, items, values, supabase])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!csvFile || !selectedPharmacy || !csvImportTargetMonth) return
    setCsvImporting(true)
    setMessage(null)
    const fd = new FormData()
    fd.append('file', csvFile)
    fd.append('pharmacy_id', selectedPharmacy)
    fd.append('year_month', csvImportTargetMonth)
    const res = await fetch('/api/import/csv', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage('取り込み失敗: ' + (data.error ?? 'エラー'))
    } else {
      setMessage(`${csvImportTargetMonth} のCSV取り込み完了（${data.imported}項目）`)
      setCsvFile(null)
      const v: Record<string, string> = {}
      data.items?.forEach((r: { code: string; value: number }) => { v[r.code] = String(r.value) })
      setValues((prev) => ({
        ...prev,
        [csvImportTargetMonth]: { ...(prev[csvImportTargetMonth] ?? {}), ...v },
      }))
      await fetch('/api/kasan/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacy_id: selectedPharmacy, year_month: csvImportTargetMonth }),
      }).catch(() => {})
      setImportLogs((prev) => [{
        id: crypto.randomUUID(),
        file_name: csvFile?.name ?? '',
        row_count: data.row_count ?? null,
        imported_at: new Date().toISOString(),
        pharmacy_name: pharmacies.find((p) => p.id === selectedPharmacy)?.name ?? '-',
      }, ...prev.slice(0, 9)])
    }
    setCsvImporting(false)
  }

  const updateValue = useCallback((ym: string, code: string, val: string) => {
    setValues((v) => ({
      ...v,
      [ym]: { ...(v[ym] ?? {}), [code]: val },
    }))
  }, [])

  const filledCount = useMemo(() => {
    let n = 0
    for (const ym of past12Months) {
      for (const item of items) {
        const v = values[ym]?.[item.code]?.trim()
        if (v && parseFloat(v) !== 0) n++
      }
    }
    return n
  }, [values, past12Months, items])

  const totalCells = past12Months.length * items.length
  const progressPct = totalCells > 0 ? Math.round((filledCount / totalCells) * 100) : 0

  if (loading) {
    return (
      <div className="input-page min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[var(--input-accent)]/30 border-t-[var(--input-accent)] rounded-full animate-spin" />
          <p className="text-[var(--input-text-muted)] text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="input-page">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 input-animate-row">
        <div>
          <h1 className="text-2xl font-input-heading font-bold text-[var(--input-text)] tracking-tight">
            データ入力
          </h1>
          <p className="text-[var(--input-text-muted)] text-sm mt-1">
            タブでセル間を移動。Ctrl+S で保存。全12ヶ月を一括保存します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedPharmacy}
            onChange={(e) => setSelectedPharmacy(e.target.value)}
            className="h-11 px-4 rounded-xl bg-[var(--input-bg-card)] border border-[var(--input-border)] text-[var(--input-text)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-accent)] focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <option value="">店舗を選択</option>
            {pharmacies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={saving || recordsLoading || !selectedPharmacy}
            className="h-11 px-6 rounded-xl bg-[var(--input-accent)] text-white font-semibold text-sm shadow-lg hover:bg-[var(--input-accent-hover)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                保存中...
              </span>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>

      {message && (
        <div
          role="alert"
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium input-animate-row ${
            message.includes('失敗')
              ? 'bg-[var(--input-error)]/15 text-[var(--input-error)] border border-[var(--input-error)]/30'
              : 'bg-[var(--input-success)]/15 text-[var(--input-success)] border border-[var(--input-success)]/30'
          }`}
        >
          {message}
        </div>
      )}

      {pharmacies.length === 0 ? (
        <div className="bg-[var(--input-bg-card)] border-2 border-amber-400/50 rounded-2xl p-8 shadow-lg input-animate-row">
          <p className="text-amber-400 font-semibold">店舗が登録されていません</p>
          <p className="text-[var(--input-text-secondary)] text-sm mt-2">
            <Link href="/dashboard/settings" className="text-[var(--input-accent)] underline hover:text-[var(--input-accent-hover)] font-medium">設定</Link>から組織と店舗を作成してください。
          </p>
        </div>
      ) : (
        <>
          {/* CSV取り込み（折りたたみ） */}
          <div className="mb-6 rounded-2xl border border-[var(--input-border)] overflow-hidden bg-[var(--input-bg-card)] shadow-[var(--input-shadow)] input-animate-row">
            <button
              type="button"
              onClick={() => setCsvOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-[var(--input-text-secondary)] hover:text-[var(--input-text)] hover:bg-[var(--input-accent-muted)] transition-all duration-200"
            >
              <span className="font-medium text-sm">CSV取り込み</span>
              <span className="text-[var(--input-text-muted)] text-xs">
                ReceptyなどレセコンのCSVをアップロード
              </span>
              <span className={`text-[var(--input-text-muted)] transition-transform duration-200 ${csvOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {csvOpen && (
              <div className="px-5 pb-5 pt-0 border-t border-[var(--input-border)]">
                <form onSubmit={handleCsvImport} className="flex flex-wrap items-end gap-3 pt-4">
                  <div className="min-w-[140px]">
                    <label className="block text-xs font-medium text-[var(--input-text-muted)] mb-1.5">取り込み先の月</label>
                    <select
                      value={csvImportTargetMonth}
                      onChange={(e) => setCsvImportTargetMonth(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[var(--input-border)] text-[var(--input-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-accent)]"
                    >
                      {past12Months.map((ym) => (
                        <option key={ym} value={ym}>{ym.replace('-', '年')}月</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-[var(--input-text-muted)] mb-1.5">CSVファイル</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-[var(--input-text-secondary)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--input-accent-muted)] file:text-[var(--input-accent)] file:font-medium file:cursor-pointer"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={csvImporting || !csvFile || !selectedPharmacy}
                    className="h-10 px-5 rounded-lg bg-[var(--input-accent-muted)] text-[var(--input-accent)] font-medium text-sm hover:bg-[var(--input-accent)]/20 disabled:opacity-50 transition-colors duration-200"
                  >
                    {csvImporting ? '取り込み中...' : '取り込む'}
                  </button>
                </form>
                {importLogs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--input-border)]">
                    <p className="text-xs text-[var(--input-text-muted)] mb-2">直近の取り込み</p>
                    <div className="text-xs text-[var(--input-text-secondary)] space-y-1">
                      {importLogs.slice(0, 3).map((l) => (
                        <div key={l.id} className="flex gap-2">
                          <span>{l.file_name}</span>
                          <span>{l.pharmacy_name}</span>
                          <span>{l.imported_at ? new Date(l.imported_at).toLocaleDateString('ja-JP') : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* スプレッドシート型入力テーブル */}
          <form ref={formRef} onSubmit={handleSave} className="space-y-6">
            <div className="rounded-2xl border border-[var(--input-border)] overflow-hidden bg-[var(--input-bg-card)] shadow-[var(--input-shadow-lg)] input-animate-row">
              {/* 進捗バー */}
              <div className="px-5 py-3 bg-[var(--input-bg)]/80 border-b border-[var(--input-border)] flex items-center gap-4">
                <div className="flex-1 h-2.5 bg-[var(--input-border)] rounded-full overflow-hidden">
                  <div
                    className="input-progress-bar h-full bg-[var(--input-accent)] rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[var(--input-text-muted)] tabular-nums shrink-0">
                  {filledCount} / {totalCells} セル
                </span>
              </div>

              {recordsLoading ? (
                <div className="flex items-center justify-center py-24">
                  <span className="inline-flex items-center gap-2 text-[var(--input-text-muted)]">
                    <span className="w-5 h-5 border-2 border-[var(--input-accent)]/30 border-t-[var(--input-accent)] rounded-full animate-spin" />
                    データ読み込み中...
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-380px)]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 bg-[#f1f5f9] border-b border-r border-[var(--input-border)] px-4 py-3 text-left text-xs font-semibold text-[var(--input-text-muted)] uppercase tracking-wider min-w-[200px]">
                          実績項目
                        </th>
                        {past12Months.map((ym) => (
                          <th
                            key={ym}
                            className="sticky top-0 z-10 bg-[#f1f5f9] border-b border-[var(--input-border)] px-2 py-3 text-center text-xs font-semibold text-[var(--input-text-secondary)] min-w-[72px]"
                          >
                            {ym.replace('-', '年')}月
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedItems.map(({ group, items: groupItemsList }) => (
                        <Fragment key={group}>
                          <tr>
                            <td
                              colSpan={past12Months.length + 1}
                              className="sticky left-0 bg-[var(--input-accent-muted)] border-b border-[var(--input-border)] px-4 py-2 text-xs font-semibold text-[var(--input-accent)] uppercase tracking-wider font-input-heading"
                            >
                              {group}
                            </td>
                          </tr>
                          {groupItemsList.map((item) => (
                            <tr
                              key={item.code}
                              className="input-animate-row hover:bg-[var(--input-accent-muted)]/50 transition-colors duration-150"
                            >
                              <td className="sticky left-0 z-10 bg-[var(--input-bg-card)] border-b border-r border-[var(--input-border)] px-4 py-2">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-[var(--input-text)]">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] text-[var(--input-text-muted)]">{item.unit}</span>
                                </div>
                              </td>
                              {past12Months.map((ym) => {
                                const val = values[ym]?.[item.code] ?? ''
                                const hasValue = val.trim() !== '' && parseFloat(val) !== 0
                                return (
                                  <td
                                    key={ym}
                                    className="border-b border-[var(--input-border)] p-0 align-middle"
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      step={item.unit === '%' ? '0.1' : '1'}
                                      value={val}
                                      onChange={(e) => updateValue(ym, item.code, e.target.value)}
                                      className={`w-full min-w-[72px] h-11 px-2 text-center text-sm font-mono bg-transparent border-0 border-b border-transparent hover:border-[var(--input-border)] hover:bg-[var(--input-accent-muted)]/30 focus:outline-none focus:bg-[var(--input-accent-muted)]/50 text-[var(--input-text)] placeholder-[var(--input-text-muted)] transition-all duration-150 ${
                                        hasValue ? 'text-[var(--input-accent)] font-semibold' : ''
                                      }`}
                                      placeholder="0"
                                      tabIndex={0}
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between input-animate-row">
              <p className="text-xs text-[var(--input-text-muted)]">
                Ctrl+S で保存できます
              </p>
              <button
                type="submit"
                disabled={saving || recordsLoading || !selectedPharmacy}
                className="h-11 px-8 rounded-xl bg-[var(--input-accent)] text-white font-semibold text-sm shadow-lg hover:bg-[var(--input-accent-hover)] transition-all duration-200 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
