# PharmaNavi Supabase セットアップ手順

## 1. 環境変数（完了済み）

Vercel と `.env.local` に以下が設定されています：
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## 2. SQLの実行

以下のURLでSupabaseのSQL Editorを開き、**2つのSQLファイルを順に**実行してください。

1. https://supabase.com/dashboard/project/xnbzwibqypkgvqmulptn/sql/new

2. **1つ目**: `supabase/migrations/20240302000001_pharma_schema.sql` の内容をコピーして貼り付け、Runをクリック

3. **2つ目**: 新しいクエリで `supabase/migrations/20240302000002_pharma_auth_trigger.sql` の内容をコピーして貼り付け、Runをクリック

## 3. 認証の設定

### 3-1. Emailプロバイダー

Supabase Dashboard > **Authentication** > **Providers** で **Email** が有効になっていることを確認してください。

### 3-2. URL設定（本番ログインに必須）

Supabase Dashboard > **Authentication** > **URL Configuration** で以下を設定：

- **Site URL**: `https://pharma-navi.vercel.app`
- **Redirect URLs** に追加:
  - `https://pharma-navi.vercel.app/**`（本番）
  - `http://localhost:3000/**`（ローカル開発）

※ Site URL を本番にすると本番ログインが有効になります。ローカル開発時は Redirect URLs に localhost を入れてください。

## 4. テストユーザーの作成

**Authentication** > **Users** > **Add user** でテスト用のユーザーを作成：

- Email: 任意（例: test@pharmanavi.local）
- Password: 8文字以上、英数字含む（例: Test1234!）
- 「Create user」をクリック

## 5. ログインできない場合の確認

| 症状 | 確認すること |
|------|-------------|
| Invalid login credentials | ユーザーが存在するか、パスワードを確認 |
| Email not confirmed | Authentication > Providers > Email で「Confirm email」をOFFにするか、確認メールのリンクをクリック |
| 本番でログイン不可 | URL設定（3-2）を確認 |
