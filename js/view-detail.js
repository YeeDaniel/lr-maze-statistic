import { PROG, STAGE, BOSS_INDEX } from './config.js';
import { total, subtotal } from './stats.js';
import { decode } from './decode.js';

export function buildRows(run, mean) {
  return run.cells.map((cell, i) => {
    const d = decode(cell.score);
    return {
      prog: PROG[i],
      stage: STAGE[i],
      score: cell.score,
      target: cell.target,
      relic: d.ok ? d.candidates.join('／') : '',
      effect: d.ok ? d.effects.join(' ／ ') : '',
      dev: cell.score - mean[i],
      warn: !d.ok && i !== BOSS_INDEX
    };
  });
}

const fmt = v => Math.round(v).toLocaleString('en-US');
const signed = v => (v > 0 ? '+' : '') + fmt(v);

let root = null;
let picked = null;
let act = null;

export function mount(el, actions) {
  root = el;
  act = actions;
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-run]');
    if (!btn) return;
    picked = btn.dataset.run;
    act.rerender();
  });
}

export function update(state) {
  if (!state.runs.some(r => r.id === picked)) picked = state.runs.at(-1)?.id ?? null;
  const run = state.runs.find(r => r.id === picked);
  if (!run) { root.innerHTML = ''; return; }

  const tabs = state.runs.map(r =>
    `<button data-run="${r.id}" class="pick" aria-pressed="${r.id === picked}">${r.name}</button>`
  ).join('');

  const rows = buildRows(run, state.mean).map(r => `
    <tr class="${r.warn ? 'warn' : ''}">
      <td>${r.prog}</td>
      <td>${r.stage}</td>
      <td>${r.target || ''}${r.relic}</td>
      <td class="num">${fmt(r.score)}</td>
      <td class="num">${signed(r.dev)}</td>
    </tr>`).join('');

  root.innerHTML = `
    <h2>每輪明細</h2>
    <div class="picks">${tabs}</div>
    <p class="sub">${run.note || ''}　遺物小計 ${fmt(subtotal(run))}　總分 ${fmt(total(run))}</p>
    <table class="detail">
      <thead><tr><th>進度</th><th>關卡</th><th>遺物</th><th class="num">分數</th><th class="num">與平均</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
