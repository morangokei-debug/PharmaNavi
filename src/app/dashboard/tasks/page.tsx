'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Task = {
  id: string
  task: string
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed'
  kasan_id: string | null
  kasan_name?: string
}
type Kasan = { id: string; name: string; code: string }

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [kasanList, setKasanList] = useState<Kasan[]>([])
  const [newTask, setNewTask] = useState('')
  const [newKasanId, setNewKasanId] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const supabase = createClient()

  const loadTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: taskData } = await supabase
      .from('pharma_action_tasks')
      .select('id, task, due_date, status, kasan_id')
      .eq('user_id', user.id)
      .order('status')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (!taskData) return

    const kasanIds = Array.from(new Set(taskData.map((t) => t.kasan_id).filter(Boolean))) as string[]
    const kasanMap: Record<string, string> = {}
    if (kasanIds.length) {
      const { data: kasanData } = await supabase
        .from('pharma_kasan_master')
        .select('id, name')
        .in('id', kasanIds)
      kasanData?.forEach((k) => { kasanMap[k.id] = k.name })
    }

    setTasks(taskData.map((t) => ({
      ...t,
      kasan_name: t.kasan_id ? kasanMap[t.kasan_id] : undefined,
    })))
  }

  useEffect(() => {
    const load = async () => {
      const { data: kasan } = await supabase
        .from('pharma_kasan_master')
        .select('id, name, code')
        .eq('revision_year', 2026)
        .order('code')
      if (kasan) setKasanList(kasan)
      await loadTasks()
      setLoading(false)
    }
    load()
  }, [])

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.trim()) return
    setSaving(true)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('pharma_action_tasks')
      .insert({
        user_id: user.id,
        task: newTask.trim(),
        kasan_id: newKasanId || null,
        due_date: newDueDate || null,
      })

    if (error) {
      setMessage('追加に失敗しました: ' + error.message)
    } else {
      setNewTask('')
      setNewKasanId('')
      setNewDueDate('')
      setMessage('タスクを追加しました')
      await loadTasks()
    }
    setSaving(false)
  }

  const updateStatus = async (id: string, status: Task['status']) => {
    const { error } = await supabase
      .from('pharma_action_tasks')
      .update({ status })
      .eq('id', id)
    if (!error) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('このタスクを削除しますか？')) return
    const { error } = await supabase.from('pharma_action_tasks').delete().eq('id', id)
    if (!error) await loadTasks()
  }

  const filteredTasks = tasks.filter(
    (t) => filter === 'all' || t.status === filter
  )

  const inputBase = 'px-4 py-3 bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary placeholder-pharma-muted focus:outline-none focus:border-pharma-focus focus:ring-[3px] focus:ring-[var(--accent-glow)] disabled:opacity-40'
  const btnPrimary = 'min-h-[40px] px-4 py-2 bg-pharma-accent text-white font-semibold rounded-lg shadow-glow hover:bg-pharma-accent-secondary active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-pharma-focus focus-visible:outline-offset-3'

  if (loading) {
    return (
      <div>
        <div className="h-8 w-32 skeleton mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-pharma-text-primary mb-6">
        アクションタスク
      </h1>
      <p className="text-pharma-text-muted text-sm mb-6">
        加算達成に向けたやることリストを管理します。加算に紐づけて登録すると、ロードマップと連携できます。
      </p>

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

      <section className="bg-pharma-bg-secondary rounded-xl p-6 border border-pharma mb-8">
        <h2 className="text-lg font-semibold text-pharma-text-primary mb-4">タスクを追加</h2>
        <form onSubmit={addTask} className="space-y-4">
          <div>
            <label htmlFor="task" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
              タスク内容
            </label>
            <input
              id="task"
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="例：届出を提出する / 在宅訪問を24件達成する"
              className={`w-full ${inputBase}`}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="kasan" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                関連加算（任意）
              </label>
              <select
                id="kasan"
                value={newKasanId}
                onChange={(e) => setNewKasanId(e.target.value)}
                className={`w-full ${inputBase}`}
              >
                <option value="">選択しない</option>
                {kasanList.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="due" className="block text-sm font-medium text-pharma-text-secondary mb-1.5">
                期限（任意）
              </label>
              <input
                id="due"
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className={`w-full ${inputBase}`}
              />
            </div>
          </div>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? '追加中...' : '追加'}
          </button>
        </form>
      </section>

      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-pharma-accent text-white'
                : 'bg-pharma-bg-secondary text-pharma-text-secondary hover:bg-pharma-bg-tertiary border border-pharma'
            }`}
          >
            {f === 'all' ? 'すべて' : f === 'pending' ? '未着手' : f === 'in_progress' ? '対応中' : '完了'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-pharma-bg-secondary rounded-xl p-12 text-center">
            <p className="text-pharma-text-muted text-lg mb-2">タスクがありません</p>
            <p className="text-pharma-text-muted text-sm">上のフォームからタスクを追加してください。</p>
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div
              key={t.id}
              className="bg-pharma-bg-secondary rounded-xl p-4 border border-pharma flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${t.status === 'completed' ? 'text-pharma-text-muted line-through' : 'text-pharma-text-primary'}`}>
                  {t.task}
                </p>
                {t.kasan_name && (
                  <span className="text-xs text-pharma-accent bg-pharma-accent/10 px-2 py-0.5 rounded">
                    {t.kasan_name}
                  </span>
                )}
                {t.due_date && (
                  <span className="text-xs text-pharma-text-muted ml-2">
                    期限: {t.due_date}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={t.status}
                  onChange={(e) => updateStatus(t.id, e.target.value as Task['status'])}
                  className="px-3 py-1.5 text-sm bg-pharma-bg-tertiary border border-pharma rounded-lg text-pharma-text-primary"
                >
                  <option value="pending">未着手</option>
                  <option value="in_progress">対応中</option>
                  <option value="completed">完了</option>
                </select>
                <button
                  type="button"
                  onClick={() => deleteTask(t.id)}
                  className="p-2 text-pharma-error hover:bg-pharma-error/20 rounded-lg transition-colors"
                  aria-label="削除"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
