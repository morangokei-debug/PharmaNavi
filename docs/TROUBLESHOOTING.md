# トラブルシューティング

## 組織・店舗・届出のデータが消える・保存されない

### 症状
- 組織を作成しても表示されない、またはリロードで消える
- 店舗を追加しても消える
- 届出のチェックを入れても戻る

### 原因と対処

**1. Supabase のマイグレーションが未実行**

組織や届出のデータを保存するには、以下のマイグレーションを **すべて** 実行する必要があります。

| 順番 | ファイル | 内容 |
|------|----------|------|
| 1 | `20240302000001_pharma_schema.sql` | 基本テーブル |
| 2 | `20240302000002_pharma_auth_trigger.sql` | ユーザー作成時のプロファイル自動作成 |
| 3 | `20240302000004_pharma_approvals.sql` | 届出管理テーブル |
| 4 | `20240302000005_fix_pharma_rls_recursion.sql` | RLS 再帰解消 |
| 5 | **`20240303000001_ensure_profile_before_org.sql`** | **手動作成ユーザー対応（重要）** |
| 6 | `20240303000002_org_pharmacy_edit_delete.sql` | 編集・削除用 RLS |
| 7 | `20240303000003_pharma_approvals_rls.sql` | 届出管理 RLS |

**特に重要**: 「5つ目」の `ensure_profile_before_org` を実行していないと、組織を作成してもプロファイルに紐づかず、リロードで消えます。

**2. 実行手順**

1. [Supabase SQL Editor](https://supabase.com/dashboard/project/xnbzwibqypkgvqmulptn/sql/new) を開く
2. 上記の順番で、各ファイルの内容をコピーして貼り付け、Run をクリック
3. すべて実行後、アプリで「データを再読み込み」をクリック

**3. 実行済みか確認する方法**

Supabase SQL Editor で以下を実行：

```sql
-- 届出テーブルが存在するか
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pharma_pharmacy_approvals');
-- true なら OK

-- create_organization がプロファイル作成を含むか
SELECT prosrc FROM pg_proc WHERE proname = 'create_organization';
-- 結果に "INSERT INTO pharma_profiles" が含まれていれば OK
```
