import { RELICS } from './official.js';
import { PROG } from './config.js';
import { esc } from './esc.js';

/**
 * 把官方十二組分數攤成刻度，疊上實測命中次數與出處。
 */
export function buildPanels(runs) {
  const hits = new Map();   // score -> string[]（出處）
  for (const run of runs) {
    run.cells.forEach((cell, i) => {
      if (!cell.score) return;
      if (!hits.has(cell.score)) hits.set(cell.score, []);
      hits.get(cell.score).push(`${run.name} ${PROG[i]}`);
    });
  }

  return Object.entries(RELICS).map(([key, rows]) => ({
    key,
    ticks: rows.map(([score, name]) => {
      const from = hits.get(score) || [];
      return { score, name, hits: from.length, from };
    })
  }));
}

let root = null;

export function mount(el, _actions) { root = el; }   // 分布圖不需要 actions，簽章統一

export function update(state) {
  const panels = buildPanels(state.runs.filter(r => state.visible.has(r.id)));
  const observed = panels.reduce((a, p) =>
    a + p.ticks.reduce((b, t) => b + t.hits, 0), 0);

  root.innerHTML = `
    <h2>遺物分數分布</h2>
    <p class="sub">你的 <span class="num">${observed}</span> 顆遺物，
      疊在官方 94 個分數的完整空間上 · 滑到刻度上看細節</p>
    <div class="dlg">
      <span><i style="width:1px;height:12px;border-radius:0;background:var(--line2)"></i>官方所有可能分數</span>
      <span><i style="background:#2a78d6"></i>你抽到的（負向）</span>
      <span><i style="background:#eb6834"></i>你抽到的（正向）</span>
    </div>
    ${panels.map(p => renderPanel(p)).join('')}`;
}

function renderPanel(panel) {
  const [grade, sign, kind] = panel.key.split('|');
  const scores = panel.ticks.map(t => t.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  const span = hi - lo || 1;
  const colour = sign === '負' ? '#2a78d6' : '#eb6834';

  const marks = panel.ticks.map(t => {
    const pct = ((t.score - lo) / span) * 100;
    const title = t.hits
      ? `${t.score}　${t.name}　抽中 ${t.hits} 次\n${t.from.join('\n')}`
      : `${t.score}　${t.name}　未抽中`;
    const dot = t.hits
      ? `<i class="dot" style="background:${colour};transform:scale(${1 + Math.min(t.hits, 6) * 0.18})"></i>`
      : '';
    // title 含趟次名稱，是使用者可控文字（可能來自匯入的 JSON），必須跳脫
    return `<span class="tick" style="left:${pct}%" title="${esc(title)}">${dot}</span>`;
  }).join('');

  return `
    <div class="panel">
      <div class="plabel">${grade} 級 · ${sign}向 · ${kind}</div>
      <div class="axis">${marks}</div>
      <div class="prange"><span>${lo.toLocaleString('en-US')}</span><span>${hi.toLocaleString('en-US')}</span></div>
    </div>`;
}
