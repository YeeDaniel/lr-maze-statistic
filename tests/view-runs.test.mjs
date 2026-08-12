import { test, ok, eq } from './harness.mjs';
import { BASELINE } from '../js/baseline.js';
import { blankRun } from '../js/store.js';
import { HUE } from '../js/palette.js';
import { buildDatasets } from '../js/view-chart.js';
import { buildRows, buildBuiltinToggle } from '../js/view-runs.js';

const mkState = (over = {}) => ({
  runs: BASELINE,
  visible: new Set(BASELINE.map(r => r.id)),
  ...over
});

test('每趟一列，欄位齊全', () => {
  const rows = buildRows(mkState());
  eq(rows.length, 6);
  eq(rows[0].id, BASELINE[0].id);
  eq(rows[0].name, BASELINE[0].name);
});

test('顯示中的趟 visible 為 true', () => {
  const rows = buildRows(mkState());
  ok(rows.every(r => r.visible === true), '全部都在 visible 集合裡，應該全部 true');
});

test('被藏起來的趟 visible 為 false，其餘不受影響', () => {
  const hiddenId = BASELINE[1].id;
  const state = mkState({ visible: new Set(BASELINE.filter(r => r.id !== hiddenId).map(r => r.id)) });
  const rows = buildRows(state);
  eq(rows[1].visible, false);
  eq(rows[0].visible, true);
  eq(rows[2].visible, true);
});

test('顏色跟折線圖用同一份 palette、同一種 index 對應', () => {
  const state = mkState();
  const rows = buildRows(state);
  const datasets = buildDatasets({ ...state, mode: 'raw', mean: [] });
  for (let i = 0; i < rows.length; i++) {
    eq(rows[i].color, HUE[i % HUE.length], `第 ${i} 列顏色應該是 HUE[${i % HUE.length}]`);
    eq(rows[i].color, datasets[i].borderColor, `第 ${i} 列顏色應該跟折線圖第 ${i} 條線一致`);
  }
});

test('顏色循環不會用完（超過 HUE 長度時回頭重用）', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...BASELINE[0], id: `x${i}`, name: `第${i}趟` }));
  const rows = buildRows(mkState({ runs: many, visible: new Set(many.map(r => r.id)) }));
  eq(rows.length, 10);
  eq(rows[8].color, rows[0].color, '第 8 趟應該跟第 0 趟撞色（HUE 只有 8 種）');
});

test('總分最高的那趟 pct 是 100', () => {
  const rows = buildRows(mkState());
  const maxTotal = Math.max(...rows.map(r => r.total));
  const top = rows.find(r => r.total === maxTotal);
  eq(top.pct, 100);
});

test('內建全部顯示中時，開關要提供「隱藏」', () => {
  const t = buildBuiltinToggle(mkState());
  eq(t.count, 6);
  eq(t.shown, true);
  eq(t.label, '隱藏內建 6 趟');
});

test('內建全部藏起來時，開關要提供「顯示」', () => {
  const t = buildBuiltinToggle(mkState({ visible: new Set() }));
  eq(t.shown, false);
  eq(t.label, '顯示內建 6 趟');
});

test('內建還剩一趟看得見就算顯示中，按下去是全部收起來', () => {
  const t = buildBuiltinToggle(mkState({ visible: new Set([BASELINE[3].id]) }));
  eq(t.shown, true, '只要還有一條線在圖上，按鈕就該是「隱藏」');
});

test('自己的趟不影響內建開關', () => {
  const mine = { ...blankRun('我的一趟'), origin: 'mine' };
  const t = buildBuiltinToggle(mkState({
    runs: [...BASELINE, mine],
    visible: new Set([mine.id])
  }));
  eq(t.count, 6, '只數內建的');
  eq(t.shown, false, '內建都藏起來了，自己那趟看得見不算數');
});

test('沒有內建可藏時不給開關', () => {
  const mine = [{ ...blankRun('我的一趟'), origin: 'mine' }];
  eq(buildBuiltinToggle(mkState({ runs: mine, visible: new Set(mine.map(r => r.id)) })), null);
});

test('只有一趟（還沒填分數）時 pct 是 100，不會自己除自己得到 NaN', () => {
  const blanks = [{ ...blankRun('新的一趟'), origin: 'mine' }];
  const rows = buildRows(mkState({ runs: blanks, visible: new Set(blanks.map(r => r.id)) }));
  eq(rows.length, 1);
  eq(rows[0].pct, 100);
});
