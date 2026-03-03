-- 登録済みの組織をすべて削除する
-- 店舗・届出も連動して削除されます。プロファイルの組織紐づけは解除されます。
-- Supabase SQL Editor で実行してください。

-- 【1】削除対象の確認（先に実行して確認）
SELECT id, name, created_at FROM pharma_organizations ORDER BY created_at;

-- 【2】問題なければ、以下の -- を外して実行
-- DELETE FROM pharma_organizations;
