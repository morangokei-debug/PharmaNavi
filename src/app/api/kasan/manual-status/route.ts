import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/** 手動加算の算定状態を更新（算定している=achieved / していない=pending） */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const pharmacyId = body.pharmacy_id as string | undefined
    const kasanId = body.kasan_id as string | undefined
    const yearMonth = body.year_month as string | undefined
    const isBilling = body.is_billing as boolean

    if (!pharmacyId || !kasanId || !yearMonth || typeof isBilling !== 'boolean') {
      return NextResponse.json(
        { error: 'pharmacy_id, kasan_id, year_month, is_billing を指定してください' },
        { status: 400 }
      )
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

    const { data: kasan } = await supabase
      .from('pharma_kasan_master')
      .select('id, evaluation_type')
      .eq('id', kasanId)
      .single()

    if (!kasan || kasan.evaluation_type !== 'manual') {
      return NextResponse.json({ error: '手動加算のみ更新できます' }, { status: 400 })
    }

    const status = isBilling ? 'achieved' : 'pending'
    const { error } = await supabase
      .from('pharma_kasan_status')
      .upsert(
        {
          pharmacy_id: pharmacyId,
          kasan_id: kasanId,
          year_month: yearMonth,
          status,
          achievement_rate: isBilling ? 100 : 0,
        },
        { onConflict: 'pharmacy_id,kasan_id,year_month' }
      )

    if (error) {
      console.error('Manual kasan status update error:', error)
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (e) {
    console.error('Manual kasan status error:', e)
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 })
  }
}
