import { test, ok, eq } from './harness.mjs';
import { RELICS } from '../js/official.js';

test('RELICS 有十二組', () => {
  eq(Object.keys(RELICS).length, 12, '組數不對');
});

test('十二組分數帶兩兩不相交', () => {
  const bands = Object.entries(RELICS)
    .map(([key, rows]) => {
      const scores = rows.map(r => r[0]);
      return { key, min: Math.min(...scores), max: Math.max(...scores) };
    })
    .sort((a, b) => a.min - b.min);

  for (let i = 1; i < bands.length; i++) {
    const prev = bands[i - 1], cur = bands[i];
    ok(cur.min > prev.max,
      `${prev.key}(最高 ${prev.max}) 與 ${cur.key}(最低 ${cur.min}) 重疊`);
  }
});

test('每個分數在全表唯一', () => {
  const seen = new Map();
  for (const [key, rows] of Object.entries(RELICS)) {
    for (const [score] of rows) {
      ok(!seen.has(score), `分數 ${score} 同時出現在 ${seen.get(score)} 與 ${key}`);
      seen.set(score, key);
    }
  }
  eq(seen.size, 94, '相異分數總數不對');
});

test('每筆都是 [分數, 名稱, 效果] 三元組', () => {
  for (const [key, rows] of Object.entries(RELICS)) {
    for (const row of rows) {
      eq(row.length, 3, `${key} 有一筆長度不是 3`);
      ok(typeof row[0] === 'number', `${key} 的分數不是數字`);
      ok(row[1].length > 0, `${key} 有一筆名稱是空的`);
    }
  }
});

// LV6遺物分數分析.md 第 2.2 節的公式：
//   類型：C = 3j、B = 10j、A = 22j
//   正向·屬性：C = 150 + 1.5j、B = 500 + 5j、A = 1100 + 11j
//   負向·屬性：C = 201 + 1j、B = 650 + 3.5j、A = 1430 + 7.7j
// 同組的類型與屬性兩份表遺物順序一致，所以可以由類型分數反推效果權重 j，
// 再用公式算出屬性分數來對帳。對得上就表示官方表符合單一公式。
const TYPE_BASE = { C: 3, B: 10, A: 22 };
const ELEM_FORMULA = {
  'C|正': j => 150 + 1.5 * j,   'C|負': j => 201 + 1 * j,
  'B|正': j => 500 + 5 * j,     'B|負': j => 650 + 3.5 * j,
  'A|正': j => 1100 + 11 * j,   'A|負': j => 1430 + 7.7 * j
};

test('官方表符合 md 第 2.2 節的計分公式', () => {
  for (const grade of ['C', 'B', 'A']) {
    for (const sign of ['正', '負']) {
      const types = RELICS[`${grade}|${sign}|類型`];
      const elems = RELICS[`${grade}|${sign}|屬性`];
      eq(types.length, elems.length, `${grade}|${sign} 兩份表筆數不一致`);

      types.forEach(([typeScore, name], i) => {
        const j = typeScore / TYPE_BASE[grade];
        ok(Number.isInteger(j), `${name} 的權重 j=${j} 不是整數`);
        eq(elems[i][1], name, `${grade}|${sign} 第 ${i + 1} 筆遺物順序對不上`);
        eq(elems[i][0], Math.round(ELEM_FORMULA[`${grade}|${sign}`](j)),
           `${name}（${grade} 級 ${sign}向）的屬性分數與公式不符`);
      });
    }
  }
});
