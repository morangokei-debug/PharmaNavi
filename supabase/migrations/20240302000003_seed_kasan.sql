-- Phase 1 主要加算の初期データ（令和6年改定）
INSERT INTO pharma_kasan_master (code, revision_year, name, points, effective_from, requirements_json) VALUES
  ('chiiki_shien_1', 2024, '地域支援体制加算1', 39, '2024-04-01', '{"condition_groups":[{"id":"common","logic":"AND","items":[{"code":"junkai","name":"届出済み","type":"approval"},{"code":"jizai","name":"在宅届出","type":"approval"}]},{"id":"jisseki_a","logic":"OR","min_count":1,"items":[{"code":"yakan","name":"夜間・休日対応 年12件以上","type":"metric","metric_code":"jikangai_count","threshold":{"value":12,"period":"year","operator":">="}},{"code":"zaitaku","name":"在宅患者への調剤 年24件以上","type":"metric","metric_code":"zaitaku_visit","threshold":{"value":24,"period":"year","operator":">="}}]}]}'::jsonb),
  ('chiiki_shien_2', 2024, '地域支援体制加算2', 56, '2024-04-01', '{"condition_groups":[{"id":"zaitaku_monthly","logic":"AND","items":[{"code":"zaitaku_monthly","name":"在宅患者への薬剤管理指導 月1件以上","type":"metric","metric_code":"zaitaku_visit","threshold":{"value":1,"period":"month","operator":">="}}]}]}'::jsonb),
  ('renkei_kyoka', 2024, '連携強化加算', 5, '2024-04-01', '{"condition_groups":[{"id":"common","logic":"AND","items":[{"code":"chiiki_junkai","name":"地域支援体制加算届出","type":"approval"}]}]}'::jsonb),
  ('iryo_dx', 2024, '医療DX推進体制整備加算', 4, '2024-04-01', '{"condition_groups":[{"id":"common","logic":"AND","items":[{"code":"mynumber","name":"マイナ保険証確認割合 月80%以上","type":"metric","metric_code":"mynumber_confirm_pct","threshold":{"value":80,"period":"month","operator":">="}},{"code":"denshi","name":"電子処方箋受付 月1件以上","type":"metric","metric_code":"denshi_count","threshold":{"value":1,"period":"month","operator":">="}}]}]}'::jsonb)
ON CONFLICT (code, revision_year) DO UPDATE SET
  name = EXCLUDED.name,
  points = EXCLUDED.points,
  requirements_json = EXCLUDED.requirements_json;
