-- PharmaNavi 初期スキーマ
-- 令和6年診療報酬改定対応

-- 組織（複数店舗をまとめる）
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 店舗
CREATE TABLE pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  license_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ユーザー（Supabase Authと連携、profilesとして拡張）
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'store_manager', 'user', 'data_entry')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 加算マスタ（改定ごとにレコード、内部codeで識別）
CREATE TABLE kasan_master (
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

-- 指標マスタ（服薬フォロー件数、在宅件数など）
CREATE TABLE item_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT '件',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 月次実績（店舗・年月・指標の値）
CREATE TABLE monthly_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  item_code TEXT NOT NULL REFERENCES item_master(code),
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pharmacy_id, year_month, item_code)
);

-- 加算達成状況（自動計算または手動）
CREATE TABLE kasan_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  kasan_id UUID NOT NULL REFERENCES kasan_master(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('achieved', 'partial', 'pending', 'not_applicable')),
  achievement_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pharmacy_id, kasan_id, year_month)
);

-- アクションタスク（スタッフ別）
CREATE TABLE action_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kasan_id UUID REFERENCES kasan_master(id) ON DELETE SET NULL,
  task TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CSV取込ログ
CREATE TABLE csv_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  row_count INTEGER,
  imported_at TIMESTAMPTZ DEFAULT now()
);

-- RLS有効化
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasan_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasan_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_logs ENABLE ROW LEVEL SECURITY;

-- kasan_master: 全員閲覧可
CREATE POLICY "kasan_master_read" ON kasan_master FOR SELECT USING (true);

-- item_master: 全員閲覧可
CREATE POLICY "item_master_read" ON item_master FOR SELECT USING (true);

-- organizations: 自組織のみ
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- pharmacies: 自組織の店舗のみ
CREATE POLICY "pharmacy_select" ON pharmacies FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- profiles: 自分 or 同組織のユーザー
CREATE POLICY "profile_select" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND organization_id IS NOT NULL)
  );

-- monthly_records: 自組織の店舗のデータのみ
CREATE POLICY "monthly_records_all" ON monthly_records FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharmacies WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- kasan_status: 同上
CREATE POLICY "kasan_status_all" ON kasan_status FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharmacies WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- action_tasks: 自分のタスク or 管理対象
CREATE POLICY "action_tasks_all" ON action_tasks FOR ALL
  USING (user_id = auth.uid() OR user_id IN (SELECT id FROM profiles WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- csv_import_logs: 自組織の店舗
CREATE POLICY "csv_import_logs_all" ON csv_import_logs FOR ALL
  USING (pharmacy_id IN (SELECT id FROM pharmacies WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- 初期指標マスタ
INSERT INTO item_master (code, name, unit, description) VALUES
  ('shohosen_count', '処方箋受付件数', '件', '月間処方箋受付件数'),
  ('zaitaku_visit', '在宅患者訪問薬剤管理指導件数', '件', ''),
  ('fukuyaku_follow', '服薬フォローアップ件数', '件', ''),
  ('kakaritsuke_count', 'かかりつけ薬剤師算定件数', '件', ''),
  ('mayaku_count', '麻薬調剤件数', '件', ''),
  ('chofuku_count', '重複投薬・相互作用等防止加算件数', '件', ''),
  ('mynumber_confirm_pct', 'マイナ保険証確認割合', '%', ''),
  ('denshi_count', '電子処方箋受付件数', '件', ''),
  ('jikangai_count', '時間外・休日対応件数', '件', '');
