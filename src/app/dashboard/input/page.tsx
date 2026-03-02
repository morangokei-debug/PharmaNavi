'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Pharmacy = { id: string; name: string }
type Item = { code: string; name: string; unit: string }

export default function InputPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState('')
  const [yearMonth, setYearMonth] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: phData } = await supabase
        .from('pharma_pharmacies')
        .select('id, name')
        .order('name')
      if (phData) setPharmacies(phData)

      const { data: itemData } = await supabase
        .from('pharma_item_master')
        .select('code, name, unit')
        .order('code')
      if (itemData) setItems(itemData)

      const now = new Date()
      setYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedPharmacy || !yearMonth) return
    const load = async () => {
      const { data } = await supabase
        .from('pharma_monthly_records')
        .select('item_code, value')
        .eq('pharmacy_id', selectedPharmacy)
        .eq('year_month', yearMonth)
      const v: Record<string, string> = {}
      data?.forEach((r) => { v[r.item_code] = String(r.value) })
      setValues(v)
    }
    load()
  }, [selectedPharmacy, yearMonth])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPharmacy || !yearMonth) return
    setSaving(true)
    setMessage(null)

    for (const item of items) {
      const val = values[item.code]?.trim()
      const num = val ? parseFloat(val) : 0
      const { error } = await supabase
        .from('pharma_monthly_records')
        .upsert(
          { pharmacy_id: selectedPharmacy, year_month: yearMonth, item_code: item.code, value: num },
          { onConflict: 'pharmacy_id,year_month,item_code' }
        )
      if (error) {
        setMessage('保存に失敗しました: ' + error.message)
        setSaving(false)
        return
      }
    }
    await fetch('/api/kasan/recalculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pharmacy_id: selectedPharmacy, year_month: yearMonth }),
    }).catch(() => {})
    setMessage('保存しました')
    setSaving(false)
  }

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!csvFile || !selectedPharmacy || !yearMonth) return
    setCsvImporting(true)
    setMessage(null)
    const fd = new FormData()
    fd.append('file', csvFile)
    fd.append('pharmacy_id', selectedPharmacy)
    fd.append('year_month', yearMonth)
    const res = await fetch('/api/import/csv', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage('取り込み失敗: ' + (data.error ?? 'エラー'))
    } else {
      setMessage(`CSV取り込み完了（${data.imported}項目）`)
      setCsvFile(null)
      const v: Record<string, string> = {}
      data.items?.forEach((r: { code: string; value: number }) => { v[r.code] = String(r.value) })
      setValues((prev) => ({ ...prev, ...v }))
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
              ReceptyなどレセコンのCSVをアップロードすると、列名から自動でマッピングして月次実績に取り込みます。
            </p>
            <form onSubmit={handleCsvImport} className="flex flex-wrap items-end gap-3">
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

          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <label htmlFor="yearMonth" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                    対象月
                  </label>
                  <input
                    id="yearMonth"
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    className={inputBase}
                  />
                </div>
              </div>
            </div>

            <div className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
              <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">月次実績</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div key={item.code}>
                    <label htmlFor={`item-${item.code}`} className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                      {item.name} ({item.unit})
                    </label>
                    <input
                      id={`item-${item.code}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={values[item.code] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [item.code]: e.target.value }))}
                      className={inputBase}
                    />
                  </div>
                ))}
              </div>
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
