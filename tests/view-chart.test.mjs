import { test, ok, eq } from './harness.mjs';
import { BASELINE } from '../js/baseline.js';
import { meanByCheckpoint } from '../js/stats.js';
import { buildDatasets } from '../js/view-chart.js';

const mkState = (over = {}) => ({
  runs: BASELINE,
  visible: new Set(BASELINE.map(r => r.id)),
  mode: 'raw',
  mean: meanByCheckpoint(BASELINE),
  ...over
});

test('每趟一個 dataset', () => {
  eq(buildDatasets(mkState()).length, 6);
});

test('raw 模式吐原始分數', () => {
  const ds = buildDatasets(mkState());
  eq(ds[0].data[0], 342);
  eq(ds[0].label, 'LV6 1st');
});

test('dev 模式吐與平均的差', () => {
  const state = mkState({ mode: 'dev' });
  const ds = buildDatasets(state);
  eq(ds[0].data[0], 342 - state.mean[0]);
});

test('cum 模式是 dev 的前綴和', () => {
  const state = mkState({ mode: 'cum' });
  const ds = buildDatasets(state);
  const dev = buildDatasets(mkState({ mode: 'dev' }))[0].data;
  eq(ds[0].data[19], dev.reduce((a, b) => a + b, 0));
});

test('隱藏的趟標成 hidden 而不是被刪掉', () => {
  const state = mkState({ visible: new Set([BASELINE[0].id]) });
  const ds = buildDatasets(state);
  eq(ds.length, 6, '數量不該變');
  eq(ds[0].hidden, false);
  eq(ds[1].hidden, true);
});

test('顏色循環不會用完', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    ...BASELINE[0], id: `x${i}`, name: `第${i}趟`
  }));
  const ds = buildDatasets(mkState({ runs: many, visible: new Set(many.map(r => r.id)) }));
  eq(ds.length, 20);
  ok(ds.every(d => typeof d.borderColor === 'string' && d.borderColor), '顏色不該是空的');
});
