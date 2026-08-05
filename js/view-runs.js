import { total } from './stats.js';
import { esc } from './esc.js';
import { HUE } from './palette.js';

/**
 * 純函式，方便在 node 測。不碰 DOM。
 * 顏色依 state.runs 的 index 取 HUE[i % HUE.length]，跟 view-chart.js 的
 * buildDatasets 用同一份 palette、同一種索引方式，色標才會跟折線圖那條線對得起來。
 * pct 是這趟總分相對於目前清單裡最高分那趟的比例，給 .bar 的長度用。
 */
export function buildRows(state) {
  const totals = state.runs.map(r => total(r));
  const max = Math.max(...totals, 1);   // 避免全 0 時除以 0
  return state.runs.map((run, i) => ({
    id: run.id,
    name: run.name,
    total: totals[i],
    pct: Math.round((totals[i] / max) * 100),
    color: HUE[i % HUE.length],
    visible: state.visible.has(run.id)
  }));
}

const fmt = v => v.toLocaleString('en-US');
let root = null;
let act = null;

export function mount(el, actions) {
  root = el;
  act = actions;
  root.addEventListener('click', e => {
    const btn = e.target.closest('.run');
    if (!btn) return;
    act.toggleRun(btn.dataset.id);
  });
}

function renderRow(r) {
  // id 可能來自匯入的 JSON（使用者可控），data-id / rname 都要 esc。
  // color 是 palette.js 裡固定的十六進位色碼常數，不是使用者輸入，不需要 esc。
  return `
    <button type="button" class="run" data-id="${esc(r.id)}" aria-pressed="${r.visible}">
      <i class="swatch" style="border-top-color:${r.color}"></i>
      <span class="rname">${esc(r.name)}</span>
      <span class="rtot">${fmt(r.total)}</span>
      <span class="bar"><u><i style="width:${r.pct}%"></i></u><b>${r.pct}%</b></span>
    </button>`;
}

export function update(state) {
  root.innerHTML = buildRows(state).map(renderRow).join('');
}
