-- どのプロファイルにも紐づいていない組織（とその店舗・届出）を削除
-- Supabase SQL Editor で実行してください

-- 【1】削除対象の確認（先にこれを実行して確認）
SELECT o.id, o.name, o.created_at
FROM pharma_organizations o
WHERE NOT EXISTS (SELECT 1 FROM pharma_profiles f WHERE f.organization_id = o.id);

-- 【2】上記で問題なければ、以下の -- を外して実行して孤児組織を削除
-- （店舗・届出は CASCADE で自動削除されます）
-- DELETE FROM pharma_organizations
-- WHERE NOT EXISTS (SELECT 1 FROM pharma_profiles f WHERE f.organization_id = id);
