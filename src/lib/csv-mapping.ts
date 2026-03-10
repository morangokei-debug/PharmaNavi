/**
 * CSV列名 → pharma_item_master.code のマッピング
 * Recepty・他レセコンの出力列名に合わせて拡張可能
 */
export const COLUMN_TO_ITEM: Record<string, string> = {
  // 処方箋
  '処方箋受付件数': 'shohosen_count',
  '処方箋件数': 'shohosen_count',
  '処方箋数': 'shohosen_count',
  '受付件数': 'shohosen_count',
  shohosen_count: 'shohosen_count',
  // 在宅
  '在宅・訪問 総件数': 'zaitaku_visit',
  '在宅患者訪問薬剤管理指導件数': 'zaitaku_visit',
  '在宅患者訪問': 'zaitaku_visit',
  '在宅訪問': 'zaitaku_visit',
  '在宅件数': 'zaitaku_visit',
  zaitaku_visit: 'zaitaku_visit',
  // 服薬フォロー
  '服薬フォローアップ件数': 'fukuyaku_follow',
  '服薬フォロー': 'fukuyaku_follow',
  fukuyaku_follow: 'fukuyaku_follow',
  // かかりつけ
  'かかりつけ薬剤師算定件数': 'kakaritsuke_count',
  'かかりつけ算定': 'kakaritsuke_count',
  kakaritsuke_count: 'kakaritsuke_count',
  // 麻薬
  '麻薬調剤件数': 'mayaku_count',
  '麻薬件数': 'mayaku_count',
  mayaku_count: 'mayaku_count',
  // 重複防止
  '重複投薬・相互作用等防止加算件数': 'chofuku_count',
  '重複防止加算': 'chofuku_count',
  chofuku_count: 'chofuku_count',
  // マイナ
  'マイナ保険証確認割合': 'mynumber_confirm_pct',
  'マイナ確認率': 'mynumber_confirm_pct',
  '保険証確認割合': 'mynumber_confirm_pct',
  mynumber_confirm_pct: 'mynumber_confirm_pct',
  // 電子処方箋
  '電子処方箋受付件数': 'denshi_count',
  '電子処方箋': 'denshi_count',
  denshi_count: 'denshi_count',
  // 時間外
  '時間外・休日対応件数': 'jikangai_count',
  '時間外対応': 'jikangai_count',
  '休日対応': 'jikangai_count',
  jikangai_count: 'jikangai_count',
  // 2026年改定追加項目
  '調剤時残薬調整加算': 'zanryaku_yugai_count',
  '薬学的有害事象等防止加算': 'zanryaku_yugai_count',
  '残薬調整・有害事象': 'zanryaku_yugai_count',
  zanryaku_yugai_count: 'zanryaku_yugai_count',
  '外来服薬支援料': 'gairai_fukuyaku_count',
  gairai_fukuyaku_count: 'gairai_fukuyaku_count',
  '服薬情報等提供料': 'fukuyaku_info_count',
  fukuyaku_info_count: 'fukuyaku_info_count',
  '小児特定加算': 'shouni_tokutei_count',
  shouni_tokutei_count: 'shouni_tokutei_count',
  '後発医薬品調剤割合': 'kohatsu_ratio',
  '後発調剤割合': 'kohatsu_ratio',
  kohatsu_ratio: 'kohatsu_ratio',
  '在宅個人宅': 'zaitaku_visit_kojinka',
  '個人宅訪問': 'zaitaku_visit_kojinka',
  zaitaku_visit_kojinka: 'zaitaku_visit_kojinka',
}

/** マッピング対象外の列（日付・患者名など個人情報） */
export const IGNORE_COLUMNS = new Set([
  '日付', '調剤日', '患者名', '氏名', '生年月日', '住所', '電話', '処方箋番号',
  'date', 'patient', 'name', 'birth',
])

/** 合算ではなく平均を取る項目（割合など） */
export const AVERAGE_ITEMS = new Set(['mynumber_confirm_pct', 'kohatsu_ratio'])
