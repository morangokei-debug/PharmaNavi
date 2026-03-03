-- RLS無限再帰の解消: pharma_profiles の自己参照ポリシーを SECURITY DEFINER 関数で置き換え
-- 組織作成をアトミックに行う RPC を追加（作成直後の org を返せない問題も解消）

-- 1. 現在のユーザーの organization_id を返す（RLS をバイパスして再帰を防ぐ）
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM pharma_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. 組織作成 + プロファイル紐づけを一括で行う RPC
CREATE OR REPLACE FUNCTION public.create_organization(org_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;
  IF trim(org_name) = '' OR org_name IS NULL THEN
    RETURN jsonb_build_object('error', 'name required');
  END IF;
  INSERT INTO pharma_organizations (name) VALUES (trim(org_name)) RETURNING id INTO new_org_id;
  UPDATE pharma_profiles SET organization_id = new_org_id WHERE id = uid;
  RETURN jsonb_build_object('id', new_org_id);
END;
$$;

-- 3. ポリシーを再帰しない形に更新（古い自己参照ポリシーも削除）
DROP POLICY IF EXISTS "profile_select" ON pharma_profiles;
DROP POLICY IF EXISTS "pharma_profile_select" ON pharma_profiles;
CREATE POLICY "pharma_profile_select" ON pharma_profiles FOR SELECT
  USING (id = auth.uid() OR organization_id = get_my_organization_id());

DROP POLICY IF EXISTS "pharma_org_select" ON pharma_organizations;
CREATE POLICY "pharma_org_select" ON pharma_organizations FOR SELECT
  USING (id = get_my_organization_id());

DROP POLICY IF EXISTS "pharma_pharmacy_select" ON pharma_pharmacies;
CREATE POLICY "pharma_pharmacy_select" ON pharma_pharmacies FOR SELECT
  USING (organization_id = get_my_organization_id());

DROP POLICY IF EXISTS "pharma_monthly_records_all" ON pharma_monthly_records;
CREATE POLICY "pharma_monthly_records_all" ON pharma_monthly_records FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id = get_my_organization_id()));

DROP POLICY IF EXISTS "pharma_kasan_status_all" ON pharma_kasan_status;
CREATE POLICY "pharma_kasan_status_all" ON pharma_kasan_status FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id = get_my_organization_id()));

DROP POLICY IF EXISTS "pharma_action_tasks_all" ON pharma_action_tasks;
CREATE POLICY "pharma_action_tasks_all" ON pharma_action_tasks FOR ALL
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM pharma_profiles WHERE organization_id = get_my_organization_id())
  );

DROP POLICY IF EXISTS "pharma_csv_import_logs_all" ON pharma_csv_import_logs;
CREATE POLICY "pharma_csv_import_logs_all" ON pharma_csv_import_logs FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id = get_my_organization_id()));

DROP POLICY IF EXISTS "pharma_pharmacy_update" ON pharma_pharmacies;
CREATE POLICY "pharma_pharmacy_update" ON pharma_pharmacies FOR UPDATE
  USING (organization_id = get_my_organization_id());
