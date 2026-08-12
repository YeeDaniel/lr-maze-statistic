import { total } from './stats.js';
import { exportText, parseImport } from './store.js';
import { esc } from './esc.js';

export function buildList(runs) {
  return runs.map(r => ({
    id: r.id,
    name: r.name,
    note: r.note || '',
    total: total(r),
    origin: r.origin,
    badge: r.origin === 'builtin' ? '內建' : '',
    editable: r.origin === 'mine',
    deletable: r.origin !== 'builtin'
  }));
}

const fmt = v => v.toLocaleString('en-US');
let root = null;
let act = null;
let lastState = null;
let backupOpen = false;   // <details> 展開與否。整頁重繪會換掉 DOM，狀態得自己記

export function mount(el, actions) {
  root = el;
  act = actions;

  // toggle 不冒泡，只能用 capture 攔
  root.addEventListener('toggle', e => {
    if (e.target.matches('details.backup')) backupOpen = e.target.open;
  }, true);

  root.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.edit) {
      act.openEntry(lastState.runs.find(r => r.id === btn.dataset.edit));
      return;
    }

    if (btn.dataset.del) {
      const run = lastState.runs.find(r => r.id === btn.dataset.del);
      if (!confirm(`確定刪掉「${run.name}」？這個動作沒辦法復原。`)) return;
      act.mutate(mine => mine.filter(r => r.id !== btn.dataset.del));
      return;
    }

    if (btn.id === 'ex-copy') {
      await navigator.clipboard.writeText(exportText(lastState.runs));
      btn.textContent = '已複製 ✓';
      setTimeout(() => { btn.textContent = '複製備份內容'; }, 2000);
      return;
    }

    if (btn.id === 'ex-file') {
      const blob = new Blob([exportText(lastState.runs)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `lv6-遺物紀錄-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }

    if (btn.id === 'im-go') {
      const raw = root.querySelector('#im-text').value;
      const text = raw.trim();
      try {
        const incoming = parseImport(text);
        const res = act.mutate(mine => {
          const ids = new Set(mine.map(r => r.id));
          const merged = [...mine];
          for (const run of incoming) {
            if (!ids.has(run.id)) { merged.push(run); continue; }
            if (confirm(`「${run.name}」已經有一筆同 id 的資料。按確定覆蓋，按取消當成新的一趟。`)) {
              merged[merged.findIndex(r => r.id === run.id)] = run;
            } else {
              merged.push({ ...run, id: run.id + '_new' });
            }
          }
          return merged;
        });
        // act.mutate 內部已經觸發過一次整頁重繪（含這裡的 root.innerHTML），
        // 所以下面查到的都是重繪後的新節點；存檔失敗時要把使用者貼的內容還回去，
        // 不然他還得重新貼一次 JSON 才能重試。
        if (res.ok) {
          root.querySelector('#im-text').value = '';
          root.querySelector('#im-msg').textContent = `還原了 ${incoming.length} 趟。`;
        } else {
          root.querySelector('#im-text').value = raw;
          root.querySelector('#im-msg').textContent = `還原失敗：${res.error}`;
        }
      } catch (err) {
        root.querySelector('#im-text').value = raw;
        root.querySelector('#im-msg').textContent = `還原失敗：${err.message}`;
      }
    }
  });
}

export function update(state) {
  lastState = state;
  const rows = buildList(state.runs).map(r => `
    <li>
      <div><b>${esc(r.name)}</b>${r.badge ? ` <em>${esc(r.badge)}</em>` : ''}
        <span class="num">${fmt(r.total)}</span></div>
      ${r.note ? `<div class="sub">${esc(r.note)}</div>` : ''}
      <div class="ops">
        ${r.editable ? `<button data-edit="${esc(r.id)}">編輯</button>` : ''}
        ${r.deletable ? `<button data-del="${esc(r.id)}" class="danger">刪除</button>` : ''}
      </div>
    </li>`).join('');

  root.innerHTML = `
    <h2>趟次</h2>
    <ul class="runlist">${rows}</ul>

    <details class="backup"${backupOpen ? ' open' : ''}>
      <summary>進階：備份與還原</summary>
      <p class="sub">換手機、或要清瀏覽器資料之前，先下載一份備份。備份只含你自己輸入的趟。</p>
      <div class="ops">
        <button id="ex-copy">複製備份內容</button>
        <button id="ex-file">下載備份檔（.json）</button>
      </div>
      <p class="sub">還原：把備份的內容貼在下面，按「還原」。</p>
      <textarea id="im-text" rows="4" placeholder="把備份的內容貼在這裡"></textarea>
      <button id="im-go" class="primary">還原</button>
      <p id="im-msg" class="sub"></p>
    </details>`;
}
