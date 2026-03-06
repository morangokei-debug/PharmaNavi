/** 届出コードと表示名のマスタ（加算のapproval条件と対応）2026年改定版 */
export const APPROVAL_MASTER: { code: string; name: string; note?: string }[] = [
  { code: 'junkai_chiiki_iryo', name: '地域支援・医薬品供給対応体制加算の届出', note: '加算１の前提' },
  { code: 'zaitaku_junkai', name: '在宅患者訪問薬剤管理指導の届出', note: '在宅薬学総合体制加算の前提' },
  { code: 'zaitaku_sogo_1', name: '在宅薬学総合体制加算１の施設基準を満たす', note: '加算２の前提（加算１達成後）' },
]
