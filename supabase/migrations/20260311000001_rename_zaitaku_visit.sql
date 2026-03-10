-- 在宅患者訪問薬剤管理指導件数 → 在宅・訪問 総件数
-- 居宅療養管理指導料も含む総件数であることが分かる表記に変更
UPDATE pharma_item_master
SET name = '在宅・訪問 総件数'
WHERE code = 'zaitaku_visit';
