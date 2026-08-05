import { BASELINE } from './baseline.js';
import * as store from './store.js';
import { meanBasis, meanByCheckpoint } from './stats.js';
import * as viewChart from './view-chart.js';
import * as viewDetail from './view-detail.js';
import * as viewDist from './view-dist.js';
import * as viewEntry from './view-entry.js';
import * as viewManage from './view-manage.js';

/** localStorage 被禁時退回記憶體，功能照常，只是關掉就沒了 */
function pickStorage() {
  try {
    const probe = '__probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return { storage: localStorage, warning: null };
  } catch {
    return {
      storage: store.memoryStorage(),
      warning: '這個瀏覽器不讓存資料（可能是無痕模式），你輸入的東西關掉頁面就沒了。'
    };
  }
}

const { storage, warning: storageWarning } = pickStorage();

const state = {
  runs: [],
  visible: new Set(),
  mode: 'raw',
  tab: 'stats',
  mean: [],
  meanSource: 'builtin',
  warning: storageWarning
};

/**
 * 交給 view 用的動作。view 不 import main，需要做事就呼叫這裡的函式，
 * 相依方向維持單向 main → view-*。
 */
const actions = {
  mutate,                  // function 宣告會提升，這裡取得到
  rerender: () => render(),
  openEntry: null          // Task 9 註冊 view-entry 時填入
};

/** 已註冊的視圖。每個都要有 mount(el, actions) 與 update(state) */
const views = [];
export function register(view, el) {
  view.mount(el, actions);
  views.push(view);
}

function recompute() {
  const loaded = store.load(storage);
  state.warning = storageWarning || loaded.warning;
  state.runs = [...BASELINE, ...loaded.runs];
  const basis = meanBasis(state.runs);
  state.mean = meanByCheckpoint(basis.runs);
  state.meanSource = basis.source;
  for (const r of state.runs) if (!state.visible.has(r.id)) state.visible.add(r.id);
}

function render() {
  const warn = document.getElementById('warning');
  warn.hidden = !state.warning;
  warn.textContent = state.warning || '';

  document.getElementById('tab-stats').hidden = state.tab !== 'stats';
  document.getElementById('tab-manage').hidden = state.tab !== 'manage';
  for (const btn of document.querySelectorAll('.tab'))
    btn.setAttribute('aria-pressed', String(btn.dataset.tab === state.tab));

  const basis = document.getElementById('basis');
  basis.textContent = state.meanSource === 'mine'
    ? '基準：你自己的紀錄'
    : '基準：內建 6 趟 · 你滿 2 趟後改用自己的';

  for (const v of views) v.update(state);
}

/**
 * 改資料的唯一入口。fn 收到目前使用者自己的趟數（不含 builtin），
 * 回傳新的陣列；存檔後重算並重繪。
 */
export function mutate(fn) {
  const mine = state.runs.filter(r => r.origin !== 'builtin');
  const next = fn(mine);
  const res = store.save(storage, next);
  recompute();                                  // recompute 會重設 state.warning
  if (!res.ok) state.warning = res.error;       // 所以存檔失敗的訊息要在之後才蓋上去
  render();
}

export function setMode(m) { state.mode = m; render(); }
export function setTab(t) { state.tab = t; render(); }
export function toggleRun(id) {
  state.visible.has(id) ? state.visible.delete(id) : state.visible.add(id);
  render();
}

document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (btn) setTab(btn.dataset.tab);
});
document.getElementById('modes').addEventListener('click', e => {
  const btn = e.target.closest('.mode');
  if (!btn) return;
  for (const b of document.querySelectorAll('.mode'))
    b.setAttribute('aria-pressed', String(b === btn));
  setMode(btn.dataset.m);
});

register(viewChart, document.getElementById('c'));
register(viewDetail, document.getElementById('detail'));
register(viewDist, document.getElementById('dist'));
register(viewManage, document.getElementById('manage'));
actions.openEntry = viewEntry.open;   // Task 5 先留 null，這裡才填上
register(viewEntry, document.getElementById('entry'));

recompute();
render();
