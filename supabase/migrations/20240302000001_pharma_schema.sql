-- PharmaNavi 専用スキーマ（既存プロジェクトと共存）
-- テーブル名に pharma_ プレフィックスを使用

CREATE TABLE IF NOT EXISTS pharma_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharma_pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES pharma_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  license_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharma_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES pharma_organizations(id) ON DELETE SET NULL,
  pharmacy_id UUID REFERENCES pharma_pharmacies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'store_manager', 'user', 'data_entry')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharma_kasan_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  revision_year INTEGER NOT NULL,
  name TEXT NOT NULL,
  points INTEGER,
  effective_from DATE,
  effective_to DATE,
  predecessor_code TEXT,
  requirements_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code, revision_year)
);

CREATE TABLE IF NOT EXISTS pharma_item_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT '件',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharma_monthly_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharma_pharmacies(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  item_code TEXT NOT NULL REFERENCES pharma_item_master(code),
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pharmacy_id, year_month, item_code)
);

CREATE TABLE IF NOT EXISTS pharma_kasan_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharma_pharmacies(id) ON DELETE CASCADE,
  kasan_id UUID NOT NULL REFERENCES pharma_kasan_master(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('achieved', 'partial', 'pending', 'not_applicable')),
  achievement_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pharmacy_id, kasan_id, year_month)
);

CREATE TABLE IF NOT EXISTS pharma_action_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES pharma_profiles(id) ON DELETE CASCADE,
  kasan_id UUID REFERENCES pharma_kasan_master(id) ON DELETE SET NULL,
  task TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pharma_csv_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharma_pharmacies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES pharma_profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  row_count INTEGER,
  imported_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pharma_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_kasan_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_kasan_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_action_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharma_csv_import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pharma_kasan_master_read" ON pharma_kasan_master;
CREATE POLICY "pharma_kasan_master_read" ON pharma_kasan_master FOR SELECT USING (true);

DROP POLICY IF EXISTS "pharma_item_master_read" ON pharma_item_master;
CREATE POLICY "pharma_item_master_read" ON pharma_item_master FOR SELECT USING (true);

DROP POLICY IF EXISTS "pharma_org_select" ON pharma_organizations;
CREATE POLICY "pharma_org_select" ON pharma_organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "pharma_pharmacy_select" ON pharma_pharmacies;
CREATE POLICY "pharma_pharmacy_select" ON pharma_pharmacies FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "pharma_profile_select" ON pharma_profiles;
CREATE POLICY "pharma_profile_select" ON pharma_profiles FOR SELECT
  USING (id = auth.uid() OR organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid() AND organization_id IS NOT NULL));

DROP POLICY IF EXISTS "pharma_monthly_records_all" ON pharma_monthly_records;
CREATE POLICY "pharma_monthly_records_all" ON pharma_monthly_records FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "pharma_kasan_status_all" ON pharma_kasan_status;
CREATE POLICY "pharma_kasan_status_all" ON pharma_kasan_status FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "pharma_action_tasks_all" ON pharma_action_tasks;
CREATE POLICY "pharma_action_tasks_all" ON pharma_action_tasks FOR ALL
  USING (user_id = auth.uid() OR user_id IN (SELECT id FROM pharma_profiles WHERE organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "pharma_csv_import_logs_all" ON pharma_csv_import_logs;
CREATE POLICY "pharma_csv_import_logs_all" ON pharma_csv_import_logs FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharma_pharmacies WHERE organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "pharma_profile_insert" ON pharma_profiles;
CREATE POLICY "pharma_profile_insert" ON pharma_profiles FOR INSERT WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "pharma_profile_update" ON pharma_profiles;
CREATE POLICY "pharma_profile_update" ON pharma_profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "pharma_org_insert" ON pharma_organizations;
CREATE POLICY "pharma_org_insert" ON pharma_organizations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "pharma_pharmacy_insert" ON pharma_pharmacies;
CREATE POLICY "pharma_pharmacy_insert" ON pharma_pharmacies FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "pharma_pharmacy_update" ON pharma_pharmacies;
CREATE POLICY "pharma_pharmacy_update" ON pharma_pharmacies FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM pharma_profiles WHERE id = auth.uid()));

INSERT INTO pharma_item_master (code, name, unit, description) VALUES
  ('shohosen_count', '処方箋受付件数', '件', '月間処方箋受付件数'),
  ('zaitaku_visit', '在宅患者訪問薬剤管理指導件数', '件', ''),
  ('fukuyaku_follow', '服薬フォローアップ件数', '件', ''),
  ('kakaritsuke_count', 'かかりつけ薬剤師算定件数', '件', ''),
  ('mayaku_count', '麻薬調剤件数', '件', ''),
  ('chofuku_count', '重複投薬・相互作用等防止加算件数', '件', ''),
  ('mynumber_confirm_pct', 'マイナ保険証確認割合', '%', ''),
  ('denshi_count', '電子処方箋受付件数', '件', ''),
  ('jikangai_count', '時間外・休日対応件数', '件', '')
ON CONFLICT (code) DO NOTHING;
