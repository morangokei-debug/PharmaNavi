-- その他加算（基本料非関与）の手動算定管理
-- 吸入指導加算など、実績データと連携せず「算定しているか」を手動で管理する加算を追加

-- 1. 加算マスタに評価タイプを追加（auto=自動判定 / manual=手動入力）
ALTER TABLE pharma_kasan_master
  ADD COLUMN IF NOT EXISTS evaluation_type TEXT DEFAULT 'auto' CHECK (evaluation_type IN ('auto', 'manual'));
COMMENT ON COLUMN pharma_kasan_master.evaluation_type IS 'auto: kasan-recalcで自動判定, manual: ユーザーが算定有無を手動で設定';

-- 2. 手動加算を登録（2026年改定）
-- 吸入薬管理指導加算: 30点、6ヶ月に1回算定
-- 乳幼児服薬指導加算: 12点
-- 麻薬管理指導加算: 22点
INSERT INTO pharma_kasan_master (code, revision_year, name, points, effective_from, requirements_json, evaluation_type) VALUES
  ('kyunyuu_kanri_1', 2026, '吸入薬管理指導加算', 30, '2026-06-01', '{"type":"manual","note":"6ヶ月に1回算定。喘息・COPD・インフルエンザ吸入薬の手技指導"}'::jsonb, 'manual'),
  ('nyuyouji_fukuyaku_1', 2026, '乳幼児服薬指導加算', 12, '2026-06-01', '{"type":"manual","note":"6歳未満の乳幼児への服薬指導"}'::jsonb, 'manual'),
  ('mayaku_kanri_1', 2026, '麻薬管理指導加算', 22, '2026-06-01', '{"type":"manual","note":"麻薬・向精神薬の管理指導"}'::jsonb, 'manual')
ON CONFLICT (code, revision_year) DO UPDATE SET
  name = EXCLUDED.name,
  points = EXCLUDED.points,
  effective_from = EXCLUDED.effective_from,
  requirements_json = EXCLUDED.requirements_json,
  evaluation_type = EXCLUDED.evaluation_type;
