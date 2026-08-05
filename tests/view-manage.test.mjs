import { test, ok, eq } from './harness.mjs';
import { BASELINE } from '../js/baseline.js';
import { blankRun } from '../js/store.js';
import { buildList } from '../js/view-manage.js';

const mine = { ...blankRun('我的一趟'), origin: 'mine' };
const friend = { ...blankRun('朋友的'), origin: 'imported', from: '朋友A' };

test('列出全部趟次', () => {
  eq(buildList([...BASELINE, mine, friend]).length, 8);
});

test('內建的不可編輯不可刪', () => {
  const row = buildList(BASELINE)[0];
  eq(row.editable, false);
  eq(row.deletable, false);
  eq(row.badge, '內建');
});

test('自己的可編輯可刪', () => {
  const row = buildList([mine])[0];
  eq(row.editable, true);
  eq(row.deletable, true);
  eq(row.badge, '');
});

test('朋友的可刪不可編輯，徽章帶來源', () => {
  const row = buildList([friend])[0];
  eq(row.editable, false);
  eq(row.deletable, true);
  eq(row.badge, '來自 朋友A');
});

test('總分算進去', () => {
  eq(buildList(BASELINE)[3].total, 135475);
});
