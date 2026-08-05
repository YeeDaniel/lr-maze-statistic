import { RELICS, TYPE_TARGETS, ELEM_TARGETS } from './official.js';

/**
 * 分數 → 遺物結構。
 * 十二組分數帶兩兩不相交（見 tests/official.test.mjs），
 * 所以分數可唯一決定級距、正負、類型或屬性。
 * 推不出來的只有「力/敏/智哪一個」或「火/水/木/光/暗哪一個」
 * —— 公式裡目標種類不影響分數，那部分由使用者自己選。
 */
export function decode(score) {
  for (const [key, rows] of Object.entries(RELICS)) {
    const hit = rows.find(r => r[0] === score);
    if (!hit) continue;
    const [grade, sign, kind] = key.split('|');
    return {
      ok: true,
      grade, sign, kind,
      candidates: hit[1].split('／'),
      effects: hit[2].split(' ／ ')
    };
  }
  return { ok: false };
}

export const targetOptions = kind =>
  kind === '類型' ? TYPE_TARGETS : ELEM_TARGETS;

/** 圖表 tooltip 用的短標籤 */
export function label(score) {
  const d = decode(score);
  if (!d.ok) return '';
  return d.candidates.length > 1
    ? `${d.candidates[0]} 等${d.candidates.length}種`
    : d.candidates[0];
}
