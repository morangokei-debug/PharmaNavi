# デプロイチェックリスト

## 実施済み

- [x] 届出（approval）管理テーブル・UI
- [x] 加算判定にapprovalを組み込み
- [x] Git コミット

## ユーザーが実施する作業

### 1. GitHub へプッシュ

```bash
git push origin main
```

⏸️ GitHub へのログインが必要です。認証後、上記コマンドを実行してください。

### 2. Supabase マイグレーション

新しいテーブル `pharma_pharmacy_approvals` を追加するため、Supabase SQL Editor で以下を実行してください。

**ファイル**: `supabase/migrations/20240302000004_pharma_approvals.sql`

```sql
-- 店舗別届出状況（加算のapproval条件用）
CREATE TABLE IF NOT EXISTS pharma_pharmacy_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharma_pharmacies(id) ON DELETE CASCADE,
  approval_code TEXT NOT NULL,
  approved_at DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pharmacy_id, approval_code)
);

ALTER TABLE pharma_pharmacy_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharma_approvals_all" ON pharma_pharmacy_approvals;
CREATE POLICY "pharma_approvals_all" ON pharma_pharmacy_approvals FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid())))
  WITH CHECK (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid())));
```

### 3. Vercel デプロイ

GitHub 連携済みの場合、push で自動デプロイされます。未連携の場合は Vercel ダッシュボードからプロジェクトをインポートしてください。
