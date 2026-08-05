import { test, ok, eq } from './harness.mjs';
import { RELICS } from '../js/official.js';
import { BASELINE } from '../js/baseline.js';
import { buildPanels } from '../js/view-dist.js';

test('十二個面板，每個含該組全部官方分數', () => {
  const panels = buildPanels(BASELINE);
  eq(panels.length, 12);
  for (const p of panels) eq(p.ticks.length, RELICS[p.key].length, `${p.key} 刻度數不對`);
});

test('沒抽到的分數 hits 為 0', () => {
  const panels = buildPanels([]);
  ok(panels.every(p => p.ticks.every(t => t.hits === 0)), '沒有資料時不該有命中');
});

test('抽中次數正確累計', () => {
  const panels = buildPanels(BASELINE);
  const cNeg = panels.find(p => p.key === 'C|負|類型');
  const tick342 = cNeg.ticks.find(t => t.score === 342);
  eq(tick342.hits, 6, '342 在六趟中出現 6 次');
});

test('記錄出處', () => {
  const panels = buildPanels(BASELINE);
  const aNeg = panels.find(p => p.key === 'A|負|類型');
  const tick2684 = aNeg.ticks.find(t => t.score === 2684);
  eq(tick2684.hits, 0, '2684 六趟都沒遇過');
  const tick2640 = aNeg.ticks.find(t => t.score === 2640);
  ok(tick2640.from.length > 0, '2640 應該有出處');
  ok(tick2640.from[0].includes('LV6'), `出處格式應含趟名，實得 ${tick2640.from[0]}`);
});
