# PharmaNavi 調剤薬局コンサルシステム

診療報酬改定対応・加算積算ロードマップ・進捗ダッシュボードを提供するWebアプリケーション。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **スタイリング**: Tailwind CSS
- **DB・認証**: Supabase
- **AI**: Google Gemini API
- **デプロイ**: Vercel

## セットアップ

### 1. 環境変数

`.env.example` をコピーして `.env.local` を作成し、値を設定してください。

```bash
cp .env.example .env.local
```

必須項目:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase プロジェクトURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名キー
- `GOOGLE_API_KEY` - Gemini API キー（AI機能用）

### 2. Supabase プロジェクト設定

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. SQL Editor で `supabase/migrations/` 内のSQLを順に実行
3. Authentication > Providers で Email を有効化

### 3. 開発サーバー起動

```bash
npm install
npm run dev
```

http://localhost:3000 でアクセス

## プロジェクト構成

```
src/
├── app/           # ページ・ルーティング
├── lib/           # ユーティリティ（Supabaseクライアント等）
└── actions/       # サーバーアクション
supabase/
└── migrations/    # DBマイグレーション
```

## セキュリティ

詳細は [SECURITY.md](./SECURITY.md) を参照してください。
