import { test, ok, eq } from './harness.mjs';
import { CELLS } from '../js/config.js';
import { blankRun } from '../js/store.js';
import { BASELINE } from '../js/baseline.js';
import { buildFields, nextRunName } from '../js/view-entry.js';

test('空白趟產生 20 個欄位', () => {
  eq(buildFields(blankRun('新的')).length, CELLS);
});

test('未填分數時沒有徽章也沒有選項', () => {
  const f = buildFields(blankRun('新的'))[0];
  eq(f.badge, '');
  eq(f.options, []);
  eq(f.warn, false, '還沒填不算錯');
});

test('填了類型遺物分數給三個選項', () => {
  const run = blankRun('新的');
  run.cells[0] = { score: 342, target: null };
  const f = buildFields(run)[0];
  eq(f.badge, 'C · 負向 · 類型');
  eq(f.options, ['力', '敏', '智']);
});

test('填了屬性遺物分數給五個選項', () => {
  const run = blankRun('新的');
  run.cells[0] = { score: 317, target: null };
  const f = buildFields(run)[0];
  eq(f.badge, 'C · 負向 · 屬性');
  eq(f.options, ['火', '水', '木', '光', '暗']);
});

test('正面關不預先限制選項', () => {
  const run = blankRun('新的');
  run.cells[9] = { score: 800, target: null };  // 50% 正面B級，正向類型
  const f = buildFields(run)[9];
  eq(f.badge, 'B · 正向 · 類型');
  eq(f.options, ['力', '敏', '智'], '正向類型雖然實測沒出現過，但官方表有，不該擋掉');
});

test('查無此分數標 warn 但不鎖', () => {
  const run = blankRun('新的');
  run.cells[0] = { score: 999, target: null };
  const f = buildFields(run)[0];
  eq(f.warn, true);
  eq(f.locked, false, '警告不該阻擋輸入');
});

test('第 20 格鎖住', () => {
  const f = buildFields(blankRun('新的'))[19];
  eq(f.locked, true);
  eq(f.stage, '魔王兔兔');
  eq(f.options, []);
});

test('趟名依現有紀錄遞增', () => {
  eq(nextRunName([]), 'LV6 1st');
  eq(nextRunName(BASELINE), 'LV6 7th');
});

test('趟名遞增只看自己與內建的數量', () => {
  const runs = [...BASELINE, { ...blankRun('隨便取的'), origin: 'mine' }];
  eq(nextRunName(runs), 'LV6 8th');
});
