import { test, ok, eq } from './harness.mjs';
import { BASELINE } from '../js/baseline.js';
import { blankRun } from '../js/store.js';
import { buildList } from '../js/view-manage.js';

const mine = { ...blankRun('我的一趟'), origin: 'mine' };

test('列出全部趟次', () => {
  eq(buildList([...BASELINE, mine]).length, 7);
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

// 舊存檔裡的 imported 由 store.load 轉成 mine，但萬一有漏網的，列表也不該長出徽章
test('舊版的 imported 也不長來源徽章', () => {
  const stale = { ...blankRun('舊朋友'), origin: 'imported', from: '朋友A' };
  const row = buildList([stale])[0];
  eq(row.badge, '', '不該再出現「來自 XXX」');
  eq(row.deletable, true, '刪得掉，不然使用者救不了自己');
});

test('總分算進去', () => {
  eq(buildList(BASELINE)[3].total, 135475);
});
