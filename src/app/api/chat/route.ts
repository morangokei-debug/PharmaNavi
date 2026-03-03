import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { formatRequirementsJson } from '@/lib/format-requirements'

// gemini-1.5-flash: 安定稼働・無料枠対応。2.0系が使えない場合はこれを使用
const GEMINI_MODEL = 'gemini-1.5-flash'

const KASAN_CONTEXT = `
## 令和6年診療報酬改定 主要加算一覧

1. **地域支援体制加算1**（39点）
   - 達成条件: 届出済み かつ 在宅届出 の両方
   - かつ以下のいずれか1つ以上:
     - 夜間・休日対応 年12件以上
     - 在宅患者への調剤 年24件以上

2. **地域支援体制加算2**（56点）
   - 達成条件: 在宅患者への薬剤管理指導を月1回以上

3. **連携強化加算**（5点）
   - 達成条件: 地域支援体制加算届出（連携強化加算用）

4. **医療DX推進体制整備加算**（4点）
   - 達成条件: マイナ保険証確認体制 月80%以上 かつ 電子処方箋受付体制 月1件以上

## 届出の種類（approval）
- 地域支援体制加算 届出済み（junkai）
- 在宅届出（jizai）
- 地域支援体制加算届出（chiiki_junkai）
`

const SYSTEM_PROMPT = `あなたは調剤薬局の診療報酬・加算獲得をサポートするコンサルタントです。
薬局オーナーや薬剤師が、加算達成に向けて「何をすべきか」を具体的にアドバイスします。

${KASAN_CONTEXT}

## 回答の原則
1. **具体的に**: 「届出を出しましょう」ではなく「〇〇届出を〇〇に提出しましょう」
2. **優先順位**: 今すぐできること、今月中、中長期で整理する
3. **数値目標**: 加算条件の数値（例: 在宅24件/年）を明示する
4. **届出と実績**: 届出が必要な加算と、数値実績が必要な加算を区別する

## 絶対にやらないこと
- 法律・保険請求に関する断定的な助言
- 患者の特定・個人情報に触れる回答
- 根拠のない数値や期限の提示

## 免責（回答末尾に必ず付ける）
※ 本アドバイスはAIによる参考情報です。加算の算定要件・届出については、厚生労働省の公表資料や地域の指導を優先してください。`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI機能を利用するにはGOOGLE_API_KEYの設定が必要です。Vercelの環境変数と.env.localを確認してください。' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const message = body.message as string
    if (!message?.trim()) {
      return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 })
    }

    // ユーザーの加算達成状況を取得（コンテキストとして渡す）
    let userContext = ''
    const { data: profile } = await supabase
      .from('pharma_profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.organization_id) {
      const { data: pharmacies } = await supabase
        .from('pharma_pharmacies')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
      const { data: kasanList } = await supabase
        .from('pharma_kasan_master')
        .select('id, name, code, points, requirements_json')
        .eq('revision_year', 2024)
        .order('code')

      if (pharmacies?.length && kasanList?.length) {
        const now = new Date()
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const { data: statuses } = await supabase
          .from('pharma_kasan_status')
          .select('kasan_id, status')
          .in('pharmacy_id', pharmacies.map((p) => p.id))
          .eq('year_month', ym)

        const statusMap: Record<string, string> = {}
        statuses?.forEach((s) => {
          if (!statusMap[s.kasan_id] || s.status === 'achieved') statusMap[s.kasan_id] = s.status
        })

        const lines: string[] = ['【現在の達成状況】']
        kasanList.forEach((k) => {
          const st = statusMap[k.id] ?? 'pending'
          const conds = formatRequirementsJson(k.requirements_json)
          lines.push(`- ${k.name}（${k.points}点）: ${st === 'achieved' ? '達成' : st === 'partial' ? '一部達成' : '未達'}`)
          if (conds.length) lines.push(`  条件: ${conds.join(' / ')}`)
        })
        userContext = '\n' + lines.join('\n')
      }
    }

    const ai = new GoogleGenAI({ apiKey })
    const fullPrompt = `${userContext ? `\n${userContext}\n\n` : ''}ユーザーの質問: ${message.trim()}`

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: fullPrompt,
      config: { systemInstruction: SYSTEM_PROMPT },
    })

    const text = response.text
    if (!text) {
      return NextResponse.json({ error: 'AIからの応答を取得できませんでした' }, { status: 500 })
    }

    return NextResponse.json({ message: text })
  } catch (e) {
    console.error('Chat API error:', e)
    return NextResponse.json(
      { error: 'AIの応答中にエラーが発生しました。しばらくしてからお試しください。' },
      { status: 500 }
    )
  }
}
