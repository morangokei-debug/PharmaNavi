'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [editingPharmacyId, setEditingPharmacyId] = useState<string | null>(null)
  const [editOrgName, setEditOrgName] = useState('')
  const [editPharmacyName, setEditPharmacyName] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const fetchData = async () => {
    let { data: { user } } = await supabase.auth.getUser()
    console.log('[fetchData] user:', user?.id ?? 'null')
    if (!user) {
      await new Promise((r) => setTimeout(r, 300))
      const retry = await supabase.auth.getUser()
      user = retry.data.user
      console.log('[fetchData] retry user:', user?.id ?? 'null')
    }
    if (!user) return

    const { data: profile, error: profileError } = await supabase
      .from('pharma_profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    console.log('[fetchData] profile:', JSON.stringify(profile), 'error:', JSON.stringify(profileError))

    if (!profile?.organization_id) return

    const { data: orgData } = await supabase
      .from('pharma_organizations')
      .select('id, name')
      .eq('id', profile.organization_id)
    if (orgData?.length) {
      setOrgs(orgData)
      setSelectedOrgId(orgData[0].id)
    } else {
      setOrgs([])
      setSelectedOrgId('')
    }

    const { data: phData } = await supabase
      .from('pharma_pharmacies')
      .select('id, name, organization_id')
      .eq('organization_id', profile.organization_id)
    if (phData) {
      setPharmacies(phData)
      const phIds = phData.map((p) => p.id)
      const { data: appData, error: appError } = await supabase
        .from('pharma_pharmacy_approvals')
        .select('pharmacy_id, approval_code, approved_at')
        .in('pharmacy_id', phIds)
      if (!appError && appData) {
        const byPh: Record<string, Approval[]> = {}
        phIds.forEach((id) => { byPh[id] = [] })
        appData.forEach((a) => {
          if (!byPh[a.pharmacy_id]) byPh[a.pharmacy_id] = []
          byPh[a.pharmacy_id].push({ approval_code: a.approval_code, approved_at: a.approved_at })
        })
        setApprovalsByPharmacy(byPh)
      }
      // 届出テーブルが無い・RLSエラー時は上書きしない（既存の表示を維持）
    } else {
      setPharmacies([])
      setApprovalsByPharmacy({})
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await fetchData()
      if (!cancelled) setLoading(false)
    }
    load()

    // リロード時はセッション復元が遅れることがあるため、認証状態の変化を監視して再取得
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) fetchData()
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[createOrg] called, newOrgName:', JSON.stringify(newOrgName))
    if (!newOrgName.trim()) {
      console.log('[createOrg] empty name, returning')
      return
    }
    setSaving(true)
    setMessage(null)

    console.log('[createOrg] calling supabase.rpc...')
    const { data, error } = await supabase.rpc('create_organization', {
      org_name: newOrgName.trim(),
    })
    console.log('[createOrg] rpc result:', JSON.stringify({ data, error }))

    if (error) {
      setMessage('組織の作成に失敗しました: ' + error.message)
      setSaving(false)
      return
    }
    const result = data as { id?: string; error?: string } | null
    if (result?.error) {
      setMessage('組織の作成に失敗しました: ' + result.error)
      setSaving(false)
      return
    }
    if (!result?.id) {
      setMessage('組織の作成に失敗しました')
      setSaving(false)
      return
    }

    const createdOrgName = newOrgName.trim()
    setOrgs([{ id: result.id, name: createdOrgName }])
    setSelectedOrgId(result.id)
    setPharmacies([])
    setApprovalsByPharmacy({})
    setNewOrgName('')
    setMessage('組織を作成しました')
    console.log('[createOrg] calling fetchData...')
    await fetchData()
    console.log('[createOrg] fetchData done, orgs/pharmacies updated')
    router.refresh()
    setSaving(false)
  }

  const updateOrg = async (orgId: string, newName: string) => {
    if (!newName.trim()) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('pharma_organizations').update({ name: newName.trim() }).eq('id', orgId)
    if (error) {
      setMessage('組織の更新に失敗しました: ' + error.message)
    } else {
      setOrgs((prev) => prev.map((o) => (o.id === orgId ? { ...o, name: newName.trim() } : o)))
      setMessage('組織名を更新しました')
      router.refresh()
    }
    setSaving(false)
  }

  const deleteOrg = async (orgId: string) => {
    if (!confirm('この組織と配下の店舗・データをすべて削除します。よろしいですか？')) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('pharma_organizations').delete().eq('id', orgId)
    if (error) {
      setMessage('組織の削除に失敗しました: ' + error.message)
    } else {
      setOrgs([])
      setPharmacies([])
      setSelectedOrgId('')
      setApprovalsByPharmacy({})
      setMessage('組織を削除しました')
      await fetchData()
      router.refresh()
    }
    setSaving(false)
  }

  const updatePharmacy = async (pharmacyId: string, newName: string) => {
    if (!newName.trim()) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('pharma_pharmacies').update({ name: newName.trim() }).eq('id', pharmacyId)
    if (error) {
      setMessage('店舗の更新に失敗しました: ' + error.message)
    } else {
      setPharmacies((prev) => prev.map((p) => (p.id === pharmacyId ? { ...p, name: newName.trim() } : p)))
      setMessage('店舗名を更新しました')
      router.refresh()
    }
    setSaving(false)
  }

  const deletePharmacy = async (pharmacyId: string) => {
    if (!confirm('この店舗と関連データを削除します。よろしいですか？')) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('pharma_pharmacies').delete().eq('id', pharmacyId)
    if (error) {
      setMessage('店舗の削除に失敗しました: ' + error.message)
    } else {
      setPharmacies((prev) => prev.filter((p) => p.id !== pharmacyId))
      setApprovalsByPharmacy((prev) => {
        const next = { ...prev }
        delete next[pharmacyId]
        return next
      })
      setMessage('店舗を削除しました')
      router.refresh()
    }
    setSaving(false)
  }

  const createPharmacy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPharmacyName.trim() || !selectedOrgId) return
    setSaving(true)
    setMessage(null)

    const pharmacyName = newPharmacyName.trim()
    const { data: newPharmacy, error } = await supabase
      .from('pharma_pharmacies')
      .insert({ organization_id: selectedOrgId, name: pharmacyName })
      .select('id, name, organization_id')
      .single()

    if (error) {
      setMessage('店舗の作成に失敗しました: ' + error.message)
    } else if (newPharmacy) {
      setPharmacies((prev) => [...prev, newPharmacy])
      setApprovalsByPharmacy((prev) => ({ ...prev, [newPharmacy.id]: [] }))
      setNewPharmacyName('')
      setMessage('店舗を作成しました')
      router.refresh()
    } else {
      setMessage('店舗の作成に失敗しました')
    }
    setSaving(false)
  }

  const toggleApproval = async (pharmacyId: string, approvalCode: string, checked: boolean) => {
    console.log('[toggleApproval]', { pharmacyId, approvalCode, checked })
    setMessage(null)
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
    if (error) {
      setMessage('届出の更新に失敗しました: ' + error.message)
      return
    }
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

  const isApproved = (pharmacyId: string, code: string) =>
    approvalsByPharmacy[pharmacyId]?.some((a) => a.approval_code === code && a.approved_at) ?? false

  const inputBase = 'px-4 py-3 bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary placeholder-pharma-muted transition-[border-color,box-shadow] focus:outline-none focus:border-pharma-focus focus:ring-[3px] focus:ring-[var(--accent-glow)] focus:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed'
  const btnPrimary = 'min-h-[40px] px-4 py-2 bg-pharma-accent text-white font-semibold rounded-lg shadow-glow transition-all hover:bg-pharma-accent-secondary hover:shadow-glow-lg active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-3'

  if (loading) {
    return (
      <div>
        <div className="h-8 w-24 skeleton mb-6" />
        <div className="space-y-8">
          <div className="h-32 skeleton rounded-xl" />
          <div className="h-40 skeleton rounded-xl" />
        </div>
      </div>
    )
  }

  const handleReload = () => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-heading font-bold text-pharma-text-primary">設定</h1>
        <button
          type="button"
          onClick={handleReload}
          disabled={loading}
          className="text-sm px-4 py-2 rounded-lg border border-pharma text-pharma-text-secondary hover:bg-pharma-bg-tertiary transition-colors disabled:opacity-50"
        >
          データを再読み込み
        </button>
      </div>

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

      <div className="space-y-8">
        <section className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
          <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">組織の作成</h2>
          {orgs.length > 0 ? (
            <p className="text-sm text-pharma-success mb-4 font-medium">
              現在の組織: {orgs.map((o) => o.name).join(', ')}
            </p>
          ) : (
            <p className="text-sm text-pharma-text-muted mb-4">
              まだ組織がない場合、まず組織を作成してください。作成すると自動的にあなたがその組織に紐づきます。
            </p>
          )}
          <form onSubmit={createOrg} className="flex gap-3">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="組織名（例：〇〇薬局グループ）"
              className={`flex-1 ${inputBase}`}
              aria-label="組織名"
            />
            <button type="submit" disabled={saving} className={btnPrimary}>
              作成
            </button>
          </form>
        </section>

        <section className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
          <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">店舗の追加</h2>
          {orgs.length === 0 ? (
            <div className="space-y-2">
              <p className="text-pharma-text-muted text-sm">先に組織を作成してください。</p>
              <p className="text-pharma-text-muted text-sm">
                組織を作成したのに表示されない・リロードで消える場合は、画面上部の「データを再読み込み」をクリックしてください。
                それでも解決しない場合は <code className="text-xs bg-pharma-bg-tertiary px-1 rounded">docs/TROUBLESHOOTING.md</code> を確認してください。
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-pharma-text-muted mb-4">組織に店舗を追加します。</p>
              <form onSubmit={createPharmacy} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="org-select" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                    組織
                  </label>
                  <select
                    id="org-select"
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className={`w-full ${inputBase}`}
                  >
                    <option value="">組織を選択</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newPharmacyName}
                    onChange={(e) => setNewPharmacyName(e.target.value)}
                    placeholder="店舗名"
                    className={`flex-1 ${inputBase}`}
                    aria-label="店舗名"
                  />
                  <button
                    type="submit"
                    disabled={saving || !selectedOrgId}
                    className={btnPrimary}
                  >
                    追加
                  </button>
                </div>
              </form>
              {pharmacies.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-pharma-text-secondary mb-2">登録済み店舗</p>
                  <ul className="text-sm text-pharma-text-muted space-y-1">
                    {pharmacies.map((p) => (
                      <li key={p.id}>・{p.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <section className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
          <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">組織・店舗一覧</h2>
          <p className="text-sm text-pharma-text-muted mb-4">
            登録済みの組織と店舗を確認・編集・削除できます。
          </p>
          {orgs.length === 0 ? (
            <p className="text-pharma-text-muted text-sm">組織が登録されていません。上で組織を作成してください。</p>
          ) : (
            <div className="space-y-6">
              {orgs.map((org) => (
                <div key={org.id} className="border border-pharma rounded-lg p-4 bg-pharma-bg-tertiary/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    {editingOrgId === org.id ? (
                      <>
                        <input
                          type="text"
                          value={editOrgName}
                          onChange={(e) => setEditOrgName(e.target.value)}
                          className={`flex-1 min-w-[200px] ${inputBase}`}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateOrg(org.id, editOrgName)
                            setEditingOrgId(null)
                          }}
                          disabled={saving}
                          className={btnPrimary}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrgId(null)
                            setEditOrgName('')
                          }}
                          className="px-4 py-2 text-pharma-text-muted hover:text-pharma-text-primary"
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-pharma-text-primary">{org.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrgId(org.id)
                            setEditOrgName(org.name)
                          }}
                          disabled={saving}
                          className="text-sm text-pharma-accent hover:underline"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteOrg(org.id)}
                          disabled={saving}
                          className="text-sm text-pharma-error hover:underline"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                  <ul className="mt-3 ml-4 space-y-2">
                    {pharmacies.filter((p) => p.organization_id === org.id).length === 0 ? (
                      <li className="text-sm text-pharma-text-muted">店舗がありません。上の「店舗の追加」で追加できます。</li>
                    ) : (
                    <>
                    {pharmacies
                      .filter((p) => p.organization_id === org.id)
                      .map((ph) => (
                        <li key={ph.id} className="flex items-center gap-3 flex-wrap">
                          {editingPharmacyId === ph.id ? (
                            <>
                              <input
                                type="text"
                                value={editPharmacyName}
                                onChange={(e) => setEditPharmacyName(e.target.value)}
                                className={`flex-1 min-w-[180px] ${inputBase} text-sm`}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  updatePharmacy(ph.id, editPharmacyName)
                                  setEditingPharmacyId(null)
                                }}
                                disabled={saving}
                                className={`${btnPrimary} text-sm`}
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPharmacyId(null)
                                  setEditPharmacyName('')
                                }}
                                className="text-sm text-pharma-text-muted hover:text-pharma-text-primary"
                              >
                                キャンセル
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-pharma-text-secondary">・{ph.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPharmacyId(ph.id)
                                  setEditPharmacyName(ph.name)
                                }}
                                disabled={saving}
                                className="text-xs text-pharma-accent hover:underline"
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePharmacy(ph.id)}
                                disabled={saving}
                                className="text-xs text-pharma-error hover:underline"
                              >
                                削除
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {pharmacies.length > 0 && (
          <section className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma">
            <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">届出管理</h2>
            <p className="text-sm text-pharma-text-muted mb-4">
              各店舗の届出状況を登録します。加算の達成判定に使用されます。
            </p>
            <div className="space-y-6">
              {pharmacies.map((ph) => (
                <div key={ph.id} className="border border-pharma rounded-lg p-4 bg-pharma-bg-tertiary/50">
                  <p className="font-medium text-pharma-text-primary mb-3">{ph.name}</p>
                  <div className="flex flex-wrap gap-4">
                    {APPROVAL_MASTER.map((a) => (
                      <label
                        key={a.code}
                        className="flex items-start gap-2 cursor-pointer min-h-[44px]"
                        title={a.note}
                      >
                        <input
                          type="checkbox"
                          checked={isApproved(ph.id, a.code)}
                          onChange={(e) => toggleApproval(ph.id, a.code, e.target.checked)}
                          className="mt-0.5 w-5 h-5 rounded border-pharma bg-pharma-bg-tertiary text-pharma-accent focus:ring-pharma-focus focus:ring-2"
                        />
                        <span className="text-sm text-pharma-text-secondary">
                          {a.name}
                          {a.note && <span className="block text-xs text-pharma-text-muted mt-0.5">{a.note}</span>}
                        </span>
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
