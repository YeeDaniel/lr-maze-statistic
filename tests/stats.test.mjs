import { test, ok, eq } from './harness.mjs';
import { CELLS } from '../js/config.js';
import { BASELINE } from '../js/baseline.js';
import { subtotal, total, meanBasis, meanByCheckpoint,
         deviation, cumulative, groupStats } from '../js/stats.js';

const mkRun = (name, scores, origin = 'mine') => ({
  id: 'x_' + name, name, note: '', origin, createdAt: '',
  cells: scores.map(s => ({ score: s, target: null }))
});
const flat = v => new Array(CELLS).fill(v);

test('baseline 有 6 趟，每趟 20 格', () => {
  eq(BASELINE.length, 6);
  for (const r of BASELINE) {
    eq(r.cells.length, CELLS, `${r.name} 格數不對`);
    eq(r.origin, 'builtin', `${r.name} origin 不對`);
  }
});

test('baseline 每趟最後一格是 0', () => {
  for (const r of BASELINE) eq(r.cells[19].score, 0, `${r.name} 第 20 格不是 0`);
});

test('baseline 六趟總分符合 md 紀錄', () => {
  eq(BASELINE.map(total),
     [132195, 132760, 134225, 135475, 134595, 133285]);
});

test('baseline 六趟遺物小計符合 md 紀錄', () => {
  eq(BASELINE.map(subtotal),
     [24639, 24752, 25045, 25295, 25119, 24857]);
});

test('total = (小計 + 1800) × 5', () => {
  eq(total(mkRun('t', flat(100))), (2000 + 1800) * 5);
});

test('自己的趟數滿 2 趟才當平均基準', () => {
  const b = BASELINE;
  eq(meanBasis(b).source, 'builtin', '0 趟時應退回內建');
  eq(meanBasis([...b, mkRun('a', flat(1))]).source, 'builtin', '1 趟時應退回內建');
  eq(meanBasis([...b, mkRun('a', flat(1)), mkRun('b', flat(3))]).source, 'mine');
});

test('不認得的 origin 不計入平均基準', () => {
  const runs = [...BASELINE,
    mkRun('a', flat(1)),
    mkRun('x1', flat(9), 'weird'),
    mkRun('x2', flat(9), 'weird')];
  eq(meanBasis(runs).source, 'builtin', '只有 mine 算數，其他 origin 不該讓基準切過去');
});

test('meanBasis 只回傳選中的來源', () => {
  const runs = [...BASELINE, mkRun('a', flat(1)), mkRun('b', flat(3))];
  const basis = meanBasis(runs);
  eq(basis.runs.length, 2);
  eq(basis.runs.map(r => r.name), ['a', 'b']);
});

test('meanByCheckpoint 逐格平均', () => {
  eq(meanByCheckpoint([mkRun('a', flat(10)), mkRun('b', flat(20))]), flat(15));
});

test('meanByCheckpoint 空陣列回傳全 0', () => {
  eq(meanByCheckpoint([]), flat(0));
});

test('deviation 是逐格減平均', () => {
  eq(deviation(mkRun('a', flat(12)), flat(10)), flat(2));
});

test('cumulative 是差距的前綴和', () => {
  const cum = cumulative(mkRun('a', flat(12)), flat(10));
  eq(cum[0], 2);
  eq(cum[19], 40);
});

test('groupStats 依級距正負類別分組', () => {
  const run = mkRun('a', [342, ...new Array(18).fill(0), 0]);
  run.cells[1] = { score: 360, target: '智' };
  const g = groupStats([run]);
  const cNegType = g.find(x => x.key === 'C|負|類型');
  eq(cNegType.n, 2);
  eq(cNegType.min, 342);
  eq(cNegType.max, 360);
  eq(cNegType.mean, 351);
});

test('groupStats 忽略查無此分數的格子', () => {
  const g = groupStats([mkRun('a', flat(0))]);
  eq(g.length, 0, '全 0 應該不產生任何分組');
});
