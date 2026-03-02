'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  if (loading) return <p className="text-slate-600">読み込み中...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">データ入力</h1>

      {pharmacies.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-amber-800 font-medium">店舗が登録されていません</p>
          <p className="text-amber-700 text-sm mt-2">
            <a href="/dashboard/settings" className="underline">設定</a>から組織と店舗を作成してください。
          </p>
        </div>
      ) : (
        <>
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('失敗') ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
              {message}
            </div>
          )}

          <div className="mb-6 bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">CSV取り込み</h2>
            <p className="text-sm text-slate-600 mb-3">
              ReceptyなどレセコンのCSVをアップロードすると、列名から自動でマッピングして月次実績に取り込みます。
            </p>
            <form onSubmit={handleCsvImport} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700"
                />
              </div>
              <button
                type="submit"
                disabled={csvImporting || !csvFile || !selectedPharmacy}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {csvImporting ? '取り込み中...' : '取り込む'}
              </button>
            </form>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">店舗</label>
                  <select
                    value={selectedPharmacy}
                    onChange={(e) => setSelectedPharmacy(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">選択してください</option>
                    {pharmacies.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">対象月</label>
                  <input
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">月次実績</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div key={item.code}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {item.name} ({item.unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values[item.code] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [item.code]: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !selectedPharmacy}
              className="px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
