import { PROG, STAGE, BOSS_INDEX } from './config.js';
import { decode, targetOptions } from './decode.js';
import { blankRun, DRAFT_KEY } from './store.js';
import { esc } from './esc.js';

export function buildFields(run) {
  return run.cells.map((cell, i) => {
    const locked = i === BOSS_INDEX;
    const d = cell.score ? decode(cell.score) : { ok: false };
    return {
      index: i,
      prog: PROG[i],
      stage: STAGE[i],
      score: cell.score,
      target: cell.target,
      badge: d.ok ? `${d.grade} · ${d.sign}向 · ${d.kind}` : '',
      options: d.ok && !locked ? targetOptions(d.kind) : [],
      locked,
      warn: !locked && cell.score > 0 && !d.ok
    };
  });
}

const ORDINAL = n => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function nextRunName(runs) {
  return `LV6 ${ORDINAL(runs.length + 1)}`;
}

let root = null;
let act = null;
let editing = null;   // 正在編輯的趟（草稿），null 表示沒開表單

export function open(run) {
  editing = run ? structuredClone(run) : null;
  render();
}

export function mount(el, actions) {
  root = el;
  act = actions;

  root.addEventListener('input', e => {
    const input = e.target.closest('input[data-i]');
    if (input) {
      const i = Number(input.dataset.i);
      const v = parseInt(input.value, 10);
      editing.cells[i].score = Number.isFinite(v) ? v : 0;
      // 分數改了，原本選的目標可能對不上新的 kind，清掉重選
      editing.cells[i].target = null;
      saveDraft();
      patchCell(i);
      return;
    }
    if (e.target.id === 'entry-name') { editing.name = e.target.value; saveDraft(); }
    if (e.target.id === 'entry-note') { editing.note = e.target.value; saveDraft(); }
  });

  root.addEventListener('click', e => {
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const i = Number(chip.dataset.i);
      editing.cells[i].target = editing.cells[i].target === chip.dataset.chip
        ? null : chip.dataset.chip;
      saveDraft();
      render();
      const next = root.querySelector(`input[data-i="${i + 1}"]`);
      if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (e.target.id === 'entry-save') commit();
    if (e.target.id === 'entry-cancel') { editing = null; clearDraft(); render(); }
  });
}

/**
 * 分數輸入框每打一個字元就會觸發 input 事件。若這裡整表 render()，
 * 會把使用者正在輸入的那個 <input> 整個換成新節點 —— 焦點與游標得事後
 * 用 focus()/setSelectionRange() 搶救回來，手機上瀏覽器對「輸入中的欄位被
 * 整個換掉」很敏感，實測會讓虛擬鍵盤閃爍甚至收起，連續輸入手感很差。
 *
 * 其實輸入框的 value 本來就是瀏覽器自己更新好的，不需要我們寫回去；
 * 需要因為這次輸入而變的，只有徽章文字、警告樣式、跟 chip 清單。
 * 只 patch 這三處、完全不碰 <input> 節點，焦點與游標自然原封不動，
 * 不需要任何搶救邏輯。
 */
function patchCell(i) {
  const f = buildFields(editing)[i];
  const cellEl = root.querySelector(`.cell[data-cell="${i}"]`);
  if (!cellEl) { render(); return; }   // 保底：找不到就整表重畫
  cellEl.classList.toggle('warn', f.warn);
  cellEl.querySelector('.badge').textContent = f.badge;
  cellEl.querySelector('.cellwarn').hidden = !f.warn;
  cellEl.querySelector('.chips').innerHTML = f.options.map(o =>
    `<button type="button" data-chip="${esc(o)}" data-i="${f.index}"
             aria-pressed="${f.target === o}">${esc(o)}</button>`).join('');
}

function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(editing)); } catch { /* 存不了就算了 */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* 同上 */ }
}

function commit() {
  const run = editing;
  act.mutate(mine => {
    const idx = mine.findIndex(r => r.id === run.id);
    if (idx >= 0) { const copy = [...mine]; copy[idx] = run; return copy; }
    return [...mine, run];
  });
  editing = null;
  clearDraft();
  render();
}

let lastState = null;

export function update(state) {
  lastState = state;
  // 有草稿而且目前沒在編輯 → 撿回來
  if (!editing) {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) editing = JSON.parse(draft);
    } catch { /* 草稿壞了就忽略 */ }
  }
  render();
}

function renderCell(f) {
  if (f.locked) {
    return `
    <div class="cell locked" data-cell="${f.index}">
      <div class="cellhead"><b>${f.prog}</b><span>${f.stage}</span></div>
      <div class="cellnote">魔王關，沒有遺物</div>
    </div>`;
  }
  return `
    <div class="cell ${f.warn ? 'warn' : ''}" data-cell="${f.index}">
      <div class="cellhead"><b>${f.prog}</b><span>${f.stage}</span></div>
      <input type="text" inputmode="numeric" pattern="[0-9]*"
             data-i="${f.index}" value="${f.score || ''}" placeholder="分數">
      <div class="badge">${f.badge}</div>
      <div class="cellwarn"${f.warn ? '' : ' hidden'}>官方表沒有這個分數，確認一下？</div>
      <div class="chips">${f.options.map(o =>
        `<button type="button" data-chip="${esc(o)}" data-i="${f.index}"
                 aria-pressed="${f.target === o}">${esc(o)}</button>`).join('')}</div>
    </div>`;
}

function render() {
  if (!root) return;
  if (!editing) {
    root.innerHTML = `<button id="entry-new" class="primary">新增一趟</button>`;
    root.querySelector('#entry-new').addEventListener('click', () => {
      open({ ...blankRun(nextRunName(lastState ? lastState.runs : [])) });
    });
    return;
  }

  const rows = buildFields(editing).map(renderCell).join('');

  root.innerHTML = `
    <div class="entry">
      <label>趟次名稱<input id="entry-name" value="${esc(editing.name)}"></label>
      <label>備註<input id="entry-note" value="${esc(editing.note)}" placeholder="例如：75% 開始坐牢"></label>
      <div class="cells">${rows}</div>
      <div class="entryfoot">
        <button id="entry-save" class="primary">存檔</button>
        <button id="entry-cancel">取消</button>
      </div>
    </div>`;
}
