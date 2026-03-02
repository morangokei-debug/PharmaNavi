import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { recalculateKasanStatus } from '@/lib/kasan-recalc'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const pharmacyId = body.pharmacy_id as string | undefined
    const yearMonth = body.year_month as string | undefined

    if (!pharmacyId || !yearMonth) {
      return NextResponse.json({ error: 'pharmacy_id と year_month を指定してください' }, { status: 400 })
    }

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

    const updated = await recalculateKasanStatus(supabase, pharmacyId, yearMonth)
    return NextResponse.json({ success: true, updated })
  } catch (e) {
    console.error('Kasan recalculate error:', e)
    return NextResponse.json({ error: '再計算中にエラーが発生しました' }, { status: 500 })
  }
}
