'use client'

import { useState, useEffect, useMemo } from 'react'
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
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvImportTargetMonth, setCsvImportTargetMonth] = useState('')
  const [csvImporting, setCsvImporting] = useState(false)
  const [importLogs, setImportLogs] = useState<ImportLog[]>([])
  const supabase = createClient()

  const past12Months = useMemo(() => getPast12Months(), [])

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
    if (!selectedPharmacy || past12Months.length === 0) return
    const load = async () => {
      const { data } = await supabase
        .from('pharma_monthly_records')
        .select('year_month, item_code, value')
        .eq('pharmacy_id', selectedPharmacy)
        .in('year_month', past12Months)
      const v: Record<string, Record<string, string>> = {}
      past12Months.forEach((ym) => { v[ym] = {} })
      data?.forEach((r) => {
        if (!v[r.year_month]) v[r.year_month] = {}
        v[r.year_month][r.item_code] = String(r.value)
      })
      setValues(v)
    }
    load()
  }, [selectedPharmacy, past12Months])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
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
  }

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

  const inputBase = 'w-full px-4 py-3 bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary placeholder-pharma-muted transition-[border-color,box-shadow] focus:outline-none focus:border-pharma-focus focus:ring-[3px] focus:ring-[var(--accent-glow)] focus:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed'
  const btnPrimary = 'min-h-[40px] px-6 py-3 bg-pharma-accent text-white font-semibold rounded-lg shadow-glow transition-all hover:bg-pharma-accent-secondary hover:shadow-glow-lg active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-3'

  if (loading) {
    return (
      <div>
        <div className="h-8 w-48 skeleton mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="h-20 skeleton rounded-xl" />
          <div className="h-20 skeleton rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-pharma-text-primary mb-6">データ入力</h1>

      {pharmacies.length === 0 ? (
        <div className="bg-pharma-bg-secondary border border-pharma-warning/50 rounded-xl p-6">
          <p className="text-pharma-warning font-medium">店舗が登録されていません</p>
          <p className="text-pharma-text-secondary text-sm mt-2">
            <Link href="/dashboard/settings" className="text-pharma-accent underline hover:text-pharma-accent-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:rounded">設定</Link>から組織と店舗を作成してください。
          </p>
        </div>
      ) : (
        <>
          {message && (
            <div
              role="alert"
              className={`mb-4 p-3 rounded-lg text-sm border ${
                message.includes('失敗')
                  ? 'bg-pharma-error/10 text-pharma-error border-pharma-error/50'
                  : 'bg-pharma-success/10 text-pharma-success border-pharma-success/50'
              }`}
            >
              {message}
            </div>
          )}

          <div className="mb-6 bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
            <h2 className="text-lg font-semibold text-pharma-text-primary mb-3">CSV取り込み</h2>
            <p className="text-sm text-pharma-text-muted mb-3">
              ReceptyなどレセコンのCSVをアップロードすると、列名から自動でマッピングして月次実績に取り込みます。取り込み先の月を選んでください。
            </p>
            <form onSubmit={handleCsvImport} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <label htmlFor="csv-target-month" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                  取り込み先の月
                </label>
                <select
                  id="csv-target-month"
                  value={csvImportTargetMonth}
                  onChange={(e) => setCsvImportTargetMonth(e.target.value)}
                  className={inputBase}
                >
                  {past12Months.map((ym) => (
                    <option key={ym} value={ym}>
                      {ym.replace('-', '年')}月
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="csv-file" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                  CSVファイル
                </label>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-pharma-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-pharma-bg-tertiary file:text-pharma-accent file:font-medium file:cursor-pointer hover:file:bg-pharma-accent/20"
                />
              </div>
              <button
                type="submit"
                disabled={csvImporting || !csvFile || !selectedPharmacy}
                className={btnPrimary}
              >
                {csvImporting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
                    取り込み中...
                  </span>
                ) : (
                  '取り込む'
                )}
              </button>
            </form>
          </div>

          {importLogs.length > 0 && (
            <div className="mb-6 bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
              <h2 className="text-lg font-semibold text-pharma-text-primary mb-3">取り込み履歴</h2>
              <div className="text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="text-pharma-text-muted border-b border-pharma">
                      <th className="text-left py-2 font-medium">日時</th>
                      <th className="text-left py-2 font-medium">ファイル</th>
                      <th className="text-left py-2 font-medium">店舗</th>
                      <th className="text-right py-2 font-medium">行数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importLogs.map((l) => (
                      <tr key={l.id} className="border-b border-pharma/50">
                        <td className="py-2 text-pharma-text-secondary">
                          {new Date(l.imported_at).toLocaleString('ja-JP')}
                        </td>
                        <td className="py-2 text-pharma-text-secondary">{l.file_name}</td>
                        <td className="py-2 text-pharma-text-secondary">{l.pharmacy_name}</td>
                        <td className="py-2 text-pharma-text-secondary text-right">
                          {l.row_count != null ? l.row_count.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
              <div>
                <label htmlFor="pharmacy" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                  店舗
                </label>
                  <select
                    id="pharmacy"
                    value={selectedPharmacy}
                    onChange={(e) => setSelectedPharmacy(e.target.value)}
                  className={inputBase}
                >
                  <option value="">選択してください</option>
                  {pharmacies.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-pharma-text-muted mt-2">
                過去12ヶ月分の実績を一括で入力・編集できます。既に入力済みのデータはそのまま残ります。
              </p>
            </div>

            <div className="space-y-4">
              {past12Months.map((ym) => (
                <div key={ym} className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
                  <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">
                    {ym.replace('-', '年')}月
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((item) => (
                      <div key={`${ym}-${item.code}`}>
                        <label htmlFor={`item-${ym}-${item.code}`} className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                          {item.name} ({item.unit})
                        </label>
                        <input
                          id={`item-${ym}-${item.code}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={values[ym]?.[item.code] ?? ''}
                          onChange={(e) => setValues((v) => ({
                            ...v,
                            [ym]: { ...(v[ym] ?? {}), [item.code]: e.target.value },
                          }))}
                          className={inputBase}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" disabled={saving || !selectedPharmacy} className={btnPrimary}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
