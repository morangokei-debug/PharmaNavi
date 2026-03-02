'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APPROVAL_MASTER } from '@/lib/approval-master'

type Organization = { id: string; name: string }
type Pharmacy = { id: string; name: string; organization_id: string }
type Approval = { approval_code: string; approved_at: string | null }

export default function SettingsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([])
  const [newOrgName, setNewOrgName] = useState('')
  const [newPharmacyName, setNewPharmacyName] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [approvalsByPharmacy, setApprovalsByPharmacy] = useState<Record<string, Approval[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('pharma_profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.organization_id) {
      const { data: orgData } = await supabase
        .from('pharma_organizations')
        .select('id, name')
        .eq('id', profile.organization_id)
      if (orgData?.length) {
        setOrgs(orgData)
        setSelectedOrgId(orgData[0].id)
      }

      const { data: phData } = await supabase
        .from('pharma_pharmacies')
        .select('id, name, organization_id')
        .eq('organization_id', profile.organization_id)
      if (phData) {
        setPharmacies(phData)
        const phIds = phData.map((p) => p.id)
        const { data: appData } = await supabase
          .from('pharma_pharmacy_approvals')
          .select('pharmacy_id, approval_code, approved_at')
          .in('pharmacy_id', phIds)
        const byPh: Record<string, Approval[]> = {}
        phIds.forEach((id) => { byPh[id] = [] })
        appData?.forEach((a) => {
          if (!byPh[a.pharmacy_id]) byPh[a.pharmacy_id] = []
          byPh[a.pharmacy_id].push({ approval_code: a.approval_code, approved_at: a.approved_at })
        })
        setApprovalsByPharmacy(byPh)
      }
    }
  }

  useEffect(() => {
    const load = async () => {
      await fetchData()
      setLoading(false)
    }
    load()
  }, [])

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setSaving(true)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: newOrg, error: orgError } = await supabase
      .from('pharma_organizations')
      .insert({ name: newOrgName.trim() })
      .select('id')
      .single()

    if (orgError) {
      setMessage('組織の作成に失敗しました: ' + orgError.message)
      setSaving(false)
      return
    }

    await supabase
      .from('pharma_profiles')
      .update({ organization_id: newOrg.id })
      .eq('id', user.id)

    setNewOrgName('')
    setMessage('組織を作成しました')
    await fetchData()
    setSaving(false)
  }

  const createPharmacy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPharmacyName.trim() || !selectedOrgId) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('pharma_pharmacies')
      .insert({ organization_id: selectedOrgId, name: newPharmacyName.trim() })

    if (error) {
      setMessage('店舗の作成に失敗しました: ' + error.message)
    } else {
      setNewPharmacyName('')
      setMessage('店舗を作成しました')
      await fetchData()
    }
    setSaving(false)
  }

  const toggleApproval = async (pharmacyId: string, approvalCode: string, checked: boolean) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('pharma_pharmacy_approvals')
      .upsert(
        {
          pharmacy_id: pharmacyId,
          approval_code: approvalCode,
          approved_at: checked ? today : null,
        },
        { onConflict: 'pharmacy_id,approval_code' }
      )
    if (!error) {
      const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      await fetch('/api/kasan/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacy_id: pharmacyId, year_month: ym }),
      }).catch(() => {})
      setApprovalsByPharmacy((prev) => {
        const list = prev[pharmacyId] ?? []
        const exists = list.find((a) => a.approval_code === approvalCode)
        let next: Approval[]
        if (exists) {
          next = list.map((a) =>
            a.approval_code === approvalCode ? { ...a, approved_at: checked ? today : null } : a
          )
        } else {
          next = [...list, { approval_code: approvalCode, approved_at: checked ? today : null }]
        }
        return { ...prev, [pharmacyId]: next }
      })
    }
  }

  const isApproved = (pharmacyId: string, code: string) =>
    approvalsByPharmacy[pharmacyId]?.some((a) => a.approval_code === code && a.approved_at) ?? false

  if (loading) return <p className="text-slate-600">読み込み中...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">設定</h1>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">
          {message}
        </div>
      )}

      <div className="space-y-8">
        <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">組織の作成</h2>
          <p className="text-sm text-slate-600 mb-4">
            まだ組織がない場合、まず組織を作成してください。作成すると自動的にあなたがその組織に紐づきます。
          </p>
          <form onSubmit={createOrg} className="flex gap-3">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="組織名（例：〇〇薬局グループ）"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              作成
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">店舗の追加</h2>
          {orgs.length === 0 ? (
            <p className="text-slate-600 text-sm">先に組織を作成してください。</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-4">組織に店舗を追加します。</p>
              <form onSubmit={createPharmacy} className="flex flex-col gap-3">
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">組織を選択</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newPharmacyName}
                    onChange={(e) => setNewPharmacyName(e.target.value)}
                    placeholder="店舗名"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={saving || !selectedOrgId}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    追加
                  </button>
                </div>
              </form>
              {pharmacies.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">登録済み店舗</p>
                  <ul className="text-sm text-slate-600">
                    {pharmacies.map((p) => (
                      <li key={p.id}>・{p.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {pharmacies.length > 0 && (
          <section className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">届出管理</h2>
            <p className="text-sm text-slate-600 mb-4">
              各店舗の届出状況を登録します。加算の達成判定に使用されます。
            </p>
            <div className="space-y-6">
              {pharmacies.map((ph) => (
                <div key={ph.id} className="border border-slate-200 rounded-lg p-4">
                  <p className="font-medium text-slate-800 mb-3">{ph.name}</p>
                  <div className="flex flex-wrap gap-4">
                    {APPROVAL_MASTER.map((a) => (
                      <label key={a.code} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isApproved(ph.id, a.code)}
                          onChange={(e) => toggleApproval(ph.id, a.code, e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
