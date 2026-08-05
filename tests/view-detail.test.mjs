import { test, ok, eq } from './harness.mjs';
import { CELLS } from '../js/config.js';
import { BASELINE } from '../js/baseline.js';
import { meanByCheckpoint } from '../js/stats.js';
import { buildRows } from '../js/view-detail.js';

const mean = meanByCheckpoint(BASELINE);

test('每趟 20 列', () => {
  eq(buildRows(BASELINE[0], mean).length, CELLS);
});

test('第一列是 5% 單線', () => {
  const row = buildRows(BASELINE[0], mean)[0];
  eq(row.prog, '5%');
  eq(row.stage, '單線');
  eq(row.score, 342);
  eq(row.target, '敏');
  eq(row.relic, '死亡寶石');
});

test('同分遺物列出全部候選', () => {
  const run = { ...BASELINE[0], cells: BASELINE[0].cells.map((c, i) =>
    i === 0 ? { score: 1200, target: '力' } : c) };
  eq(buildRows(run, mean)[0].relic, '感染的樹液／腐爛的尾巴／詛咒的咒文書');
});

test('差距是分數減平均', () => {
  const row = buildRows(BASELINE[0], mean)[0];
  eq(row.dev, 342 - mean[0]);
});

test('最後一列是魔王兔兔，沒有遺物', () => {
  const row = buildRows(BASELINE[0], mean)[19];
  eq(row.stage, '魔王兔兔');
  eq(row.score, 0);
  eq(row.relic, '');
  eq(row.warn, false, '第 20 格分數 0 是正常的，不該標警告');
});

test('查無此分數標 warn', () => {
  const run = { ...BASELINE[0], cells: BASELINE[0].cells.map((c, i) =>
    i === 0 ? { score: 999, target: null } : c) };
  const row = buildRows(run, mean)[0];
  eq(row.warn, true);
  eq(row.relic, '');
});
