-- 届出管理テーブルのRLSを get_my_organization_id() に統一（他テーブルと一貫性を保つ）
DROP POLICY IF EXISTS "pharma_approvals_all" ON pharma_pharmacy_approvals;
CREATE POLICY "pharma_approvals_all" ON pharma_pharmacy_approvals FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id = get_my_organization_id()))
  WITH CHECK (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id = get_my_organization_id()));
