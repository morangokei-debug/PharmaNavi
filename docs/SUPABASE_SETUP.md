# PharmaNavi Supabase セットアップ手順

## 1. 環境変数（完了済み）

`.env.local` に以下が設定されています：
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## 2. SQLの実行

以下のURLでSupabaseのSQL Editorを開き、**2つのSQLファイルを順に**実行してください。

1. https://supabase.com/dashboard/project/xnbzwibqypkgvqmulptn/sql/new

2. **1つ目**: `supabase/migrations/20240302000001_pharma_schema.sql` の内容をコピーして貼り付け、Runをクリック

3. **2つ目**: 新しいクエリで `supabase/migrations/20240302000002_pharma_auth_trigger.sql` の内容をコピーして貼り付け、Runをクリック

## 3. 認証の確認

Supabase Dashboard > Authentication > Providers で Email が有効になっていることを確認してください。

## 4. テストユーザーの作成

Authentication > Users > Add user でテスト用のユーザーを作成できます。
