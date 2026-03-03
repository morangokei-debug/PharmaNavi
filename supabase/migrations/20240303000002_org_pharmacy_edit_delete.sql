-- 組織・店舗の編集・削除用RLSポリシー

-- 組織: UPDATE（組織名の変更）・DELETE
DROP POLICY IF EXISTS "pharma_org_update" ON pharma_organizations;
CREATE POLICY "pharma_org_update" ON pharma_organizations FOR UPDATE
  USING (id = get_my_organization_id());

DROP POLICY IF EXISTS "pharma_org_delete" ON pharma_organizations;
CREATE POLICY "pharma_org_delete" ON pharma_organizations FOR DELETE
  USING (id = get_my_organization_id());

-- 店舗: DELETE
DROP POLICY IF EXISTS "pharma_pharmacy_delete" ON pharma_pharmacies;
CREATE POLICY "pharma_pharmacy_delete" ON pharma_pharmacies FOR DELETE
  USING (organization_id = get_my_organization_id());
