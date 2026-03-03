# PharmaNavi Supabase セットアップ手順

## 1. 環境変数

Vercel と `.env.local` に以下を設定してください：

| 変数名 | 用途 |
|--------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase接続 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase認証 |
| GOOGLE_API_KEY | AIアドバイス機能（Gemini API） |

※ GOOGLE_API_KEY が未設定の場合、AIアドバイスは利用できません。

## 2. SQLの実行

以下のURLでSupabaseのSQL Editorを開き、**2つのSQLファイルを順に**実行してください。

1. https://supabase.com/dashboard/project/xnbzwibqypkgvqmulptn/sql/new

2. **1つ目**: `supabase/migrations/20240302000001_pharma_schema.sql` の内容をコピーして貼り付け、Runをクリック

3. **2つ目**: 新しいクエリで `supabase/migrations/20240302000002_pharma_auth_trigger.sql` の内容をコピーして貼り付け、Runをクリック

4. **3つ目（届出管理用テーブル）**: 新しいクエリで `supabase/migrations/20240302000004_pharma_approvals.sql` の内容をコピーして貼り付け、Runをクリック

5. **4つ目（組織作成エラー対策）**: 新しいクエリで `supabase/migrations/20240302000005_fix_pharma_rls_recursion.sql` の内容をコピーして貼り付け、Runをクリック

6. **5つ目（手動作成ユーザー対応）**: 新しいクエリで `supabase/migrations/20240303000001_ensure_profile_before_org.sql` の内容をコピーして貼り付け、Runをクリック

7. **6つ目（組織・店舗の編集・削除）**: 新しいクエリで `supabase/migrations/20240303000002_org_pharmacy_edit_delete.sql` の内容をコピーして貼り付け、Runをクリック

8. **7つ目（届出管理RLS統一）**: 新しいクエリで `supabase/migrations/20240303000003_pharma_approvals_rls.sql` の内容をコピーして貼り付け、Runをクリック

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

## 5. AIアドバイス機能（Gemini API）について

AIアドバイス（加算達成ヒントのチャット）を使うには、**GOOGLE_API_KEY** の設定が必要です。

### 使用している構成（2025年3月時点で動作確認済み）

| 項目 | 値 |
|------|-----|
| パッケージ | `@google/genai`（公式新SDK、旧 `@google/generative-ai` は2025年8月EOL） |
| 環境変数 | `GOOGLE_API_KEY`（GEMINI_API_KEY ではない） |
| モデル | `gemini-1.5-flash`（安定稼働・無料枠対応。2.0系が使えない場合もこれ） |
| キー取得 | [Google AI Studio](https://aistudio.google.com/apikey) で発行 |

### 設定手順

1. [Google AI Studio](https://aistudio.google.com/apikey) で API キーを発行
2. Vercel の環境変数に `GOOGLE_API_KEY` を追加（本番用）
3. `.env.local` に `GOOGLE_API_KEY=...` を追加（ローカル開発用）
4. 未設定の場合、AIアドバイス画面でエラー表示されます

## 6. 組織・届出のデータが消える場合

組織や届出のチェックがリロードで消える場合は、**上記の SQL をすべて実行**しているか確認してください。特に「5つ目（手動作成ユーザー対応）」の `ensure_profile_before_org` が未実行だと、組織がプロファイルに紐づかず消えます。

詳しくは `docs/TROUBLESHOOTING.md` を参照してください。

## 7. ログインできない場合の確認

| 症状 | 確認すること |
|------|-------------|
| Invalid login credentials | ユーザーが存在するか、パスワードを確認 |
| Email not confirmed | Authentication > Providers > Email で「Confirm email」をOFFにするか、確認メールのリンクをクリック |
| 本番でログイン不可 | URL設定（3-2）を確認 |
