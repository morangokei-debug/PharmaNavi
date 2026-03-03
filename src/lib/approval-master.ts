/** 届出コードと表示名のマスタ（加算のapproval条件と対応） */
export const APPROVAL_MASTER: { code: string; name: string; note?: string }[] = [
  { code: 'junkai', name: '地域支援体制加算1用 届出済み', note: '地域支援体制加算1（39点）の前提' },
  { code: 'jizai', name: '在宅届出', note: '地域支援体制加算1の前提' },
  { code: 'chiiki_junkai', name: '連携強化加算用 地域支援体制届出', note: '連携強化加算（5点）の3条件の1つ' },
]
