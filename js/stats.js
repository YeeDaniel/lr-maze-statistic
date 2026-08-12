import { CELLS, BONUS, MULT } from './config.js';
import { decode } from './decode.js';

export const subtotal = run => run.cells.reduce((a, c) => a + c.score, 0);

/** 總分 =（遺物分數總和 + 1800）× 5 */
export const total = run => (subtotal(run) + BONUS) * MULT;

/**
 * 平均基準：自己的趟數滿 2 趟才用自己的，否則退回內建 6 趟。
 * origin 只有 builtin 與 mine 兩種，內建的不計入自己的平均。
 */
export function meanBasis(runs) {
  const mine = runs.filter(r => r.origin === 'mine');
  return mine.length >= 2
    ? { runs: mine, source: 'mine' }
    : { runs: runs.filter(r => r.origin === 'builtin'), source: 'builtin' };
}

export function meanByCheckpoint(runs) {
  if (!runs.length) return new Array(CELLS).fill(0);
  return Array.from({ length: CELLS }, (_, i) =>
    runs.reduce((a, r) => a + r.cells[i].score, 0) / runs.length);
}

export const deviation = (run, mean) =>
  run.cells.map((c, i) => c.score - mean[i]);

export function cumulative(run, mean) {
  let acc = 0;
  return run.cells.map((c, i) => (acc += c.score - mean[i]));
}

/** 依「級距|正負|類型或屬性」分組統計。查無此分數的格子略過。 */
export function groupStats(runs) {
  const buckets = new Map();
  for (const run of runs) {
    for (const cell of run.cells) {
      const d = decode(cell.score);
      if (!d.ok) continue;
      const key = `${d.grade}|${d.sign}|${d.kind}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(cell.score);
    }
  }
  return [...buckets].map(([key, scores]) => ({
    key,
    n: scores.length,
    min: Math.min(...scores),
    max: Math.max(...scores),
    mean: scores.reduce((a, b) => a + b, 0) / scores.length
  }));
}
