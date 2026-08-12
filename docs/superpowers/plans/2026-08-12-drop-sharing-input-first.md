# 拿掉共享、把輸入放到第一位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓一般使用者從頭到尾看不到「JSON」，一開頁面就在打分數，備份退到摺疊的進階區。

**Architecture:** 廢掉 `origin: 'imported'`（跨瀏覽器分享「朋友的紀錄」），只留 `builtin`（內建 6 趟唯讀）與 `mine`。`store.js` 的匯入一律標成 `mine`；`view-manage.js` 把備份／還原包進預設收合的 `<details>`；`index.html` 把輸入表單搬到趟次列表上面；`main.js` 開機時若使用者一趟都沒有就直接落在輸入頁並展開表單；存檔成功後切到統計分頁。

**Tech Stack:** 原生 ES module、手寫 CSS、Chart.js（vendor 檔）、`tests/harness.mjs` 自製斷言工具跑在 node 上。

## Global Constraints

- 無建置：不得引入 npm 套件、build step、node_modules。改完直接開 `python -m http.server 8000`
- 專案語言繁體中文：介面文案、註解、commit 訊息一律中文
- 使用者可控文字（趟名、備註、來源名）內插進 `innerHTML` 前一律經過 `js/esc.js` 的 `esc()`
- 測試指令固定 `node tests/run.mjs`，零依賴，harness 不支援單獨跑一條測試
- 不動內建 6 趟基準線，`stats.js` 的 `meanBasis`（自己滿 2 趟才用自己的）邏輯保持原樣
- 不動輸入表單的互動：分數自動推導、候選 chip 消歧、`patchCell` 不重建 `<input>` 的做法、草稿保存全部維持現狀
- 介面文字不得出現「JSON」，唯一例外是下載按鈕上的副檔名（使用者要在檔案總管認出檔案）
- 分支 `feat/input-first`，每個 task 結束各自 commit

---

## File Structure

| 檔案 | 這次負責什麼 |
|---|---|
| `js/store.js` | `parseImport` 簽名簡化成 `parseImport(text)`；`load` 把舊的 `imported` 讀成 `mine` |
| `js/view-manage.js` | `buildList` 去掉來源徽章；備份／還原包進 `<details>` 並記住開合狀態 |
| `js/view-entry.js` | `commit()` 存檔成功後改切分頁 |
| `js/main.js` | 開機決定初始分頁與是否自動展開表單；`actions` 加 `setTab` |
| `index.html` | `#entry` 與 `#manage` 對調 |
| `css/app.css` | `<details>` 樣式；刪掉 `.whose` / `#im-from` 死規則 |
| `tests/store.test.mjs` | 匯入相關測試改寫 |
| `tests/view-manage.test.mjs` | friend fixture 拿掉 |
| `README.md` | 使用說明同步 |

---

### Task 1: `store.js` 廢掉 imported

**Files:**
- Modify: `js/store.js:54-74`（`load`）、`js/store.js:93-109`（`parseImport`）
- Test: `tests/store.test.mjs:69-96`

**Interfaces:**
- Consumes: 無
- Produces:
  - `parseImport(text: string) => Run[]` —— 單一參數。每個回傳的 run 都是 `{ ...run, origin: 'mine' }` 且不含 `from` 屬性。壞資料時 throw `Error`，訊息含「格式」
  - `load(storage) => { runs: Run[], warning: string|null }` —— 行為不變，但 `origin === 'imported'` 的 run 會被轉成 `origin: 'mine'` 且移除 `from`

- [ ] **Step 1: 改寫失敗的測試**

`tests/store.test.mjs`，把第 69-96 行這四條測試（`匯出只含自己的趟`、`匯入標成 imported 並記來源`、`匯入自己的資料不帶 from`、`匯入壞資料時 throw 中文訊息`）整段換成下面五條：

```js
test('匯出只含自己的趟', () => {
  const runs = [mkRun('我的'), mkRun('內建的', 'builtin')];
  const out = JSON.parse(exportText(runs));
  eq(out.runs.map(r => r.name), ['我的']);
  eq(out.v, SCHEMA);
});

test('匯入一律標成自己的', () => {
  const text = exportText([mkRun('備份裡的一趟')]);
  const got = parseImport(text);
  eq(got.length, 1);
  eq(got[0].origin, 'mine');
  eq(got[0].from, undefined);
});

test('匯入舊版朋友資料也轉成自己的', () => {
  const text = JSON.stringify({
    v: SCHEMA,
    runs: [{ ...blankRun('舊朋友'), origin: 'imported', from: '朋友A' }]
  });
  const got = parseImport(text);
  eq(got[0].origin, 'mine');
  eq(got[0].from, undefined, 'from 應該整個拿掉，不是留 undefined 值');
  ok(!('from' in got[0]), 'from 這個 key 不該還在');
});

test('讀舊存檔時 imported 當成自己的', () => {
  const s = memoryStorage();
  s.setItem(KEY, JSON.stringify({
    v: SCHEMA,
    runs: [{ ...blankRun('舊朋友'), origin: 'imported', from: '朋友A' }]
  }));
  const res = load(s);
  eq(res.warning, null);
  eq(res.runs[0].origin, 'mine');
  ok(!('from' in res.runs[0]), 'from 這個 key 不該還在');
});

test('匯入壞資料時 throw 中文訊息', () => {
  let threw = null;
  try { parseImport('不是備份內容'); } catch (e) { threw = e.message; }
  ok(threw, '應該要 throw');
  ok(threw.includes('格式'), `訊息應提到格式，實得：${threw}`);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node tests/run.mjs`
Expected: FAIL。`匯入一律標成自己的` 會拿到 `origin` 是 `undefined`（`parseImport` 目前把第二個參數當 origin，沒傳就是 undefined），`讀舊存檔時 imported 當成自己的` 會拿到 `"imported"`。

- [ ] **Step 3: 改 `load`，把舊的 imported 轉成 mine**

`js/store.js` 第 70-73 行，把：

```js
  if (data.v > SCHEMA) {
    return { runs: [], warning: '這份存檔的版本比目前的程式新，請重新整理取得新版後再試。' };
  }
  return { runs: data.runs, warning: null };
```

換成：

```js
  if (data.v > SCHEMA) {
    return { runs: [], warning: '這份存檔的版本比目前的程式新，請重新整理取得新版後再試。' };
  }
  // origin: 'imported'（舊版的「朋友的紀錄」）已經廢掉，讀到就當成自己的
  return { runs: data.runs.map(stripImported), warning: null };
```

並在 `load` 上面（第 53 行、`export function load` 之前）加這個小工具：

```js
/** 舊版把別人的紀錄標成 imported 並記 from，現在只剩 builtin 與 mine */
function stripImported(run) {
  if (run.origin !== 'imported') return run;
  const { from, ...rest } = run;
  return { ...rest, origin: 'mine' };
}
```

- [ ] **Step 4: 改 `parseImport` 簽名**

`js/store.js` 第 93-109 行整段換成：

```js
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('資料格式不對，這不是一份備份內容');
  }
  validate(data);
  if (data.v > SCHEMA) throw new Error('這份資料的版本比目前的程式新，請先更新頁面');

  // 還原進來的一律算自己的，沒有「別人的紀錄」這種東西了
  return data.runs.map(run => {
    const { from, ...rest } = run;
    return { ...rest, origin: 'mine' };
  });
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS。`view-manage.test.mjs` 的 friend 測試這時還在，但它只吃 `buildList`、不碰 `store`，所以仍然通過。總數應該比原本多 1（四條換五條）。

- [ ] **Step 6: Commit**

```bash
git add js/store.js tests/store.test.mjs
git commit -m "refactor: store 廢掉 imported，匯入一律標成自己的"
```

---

### Task 2: `buildList` 去掉來源徽章

**Files:**
- Modify: `js/view-manage.js:5-18`
- Test: `tests/view-manage.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `store.load`（已不會再產生 `origin: 'imported'`）
- Produces: `buildList(runs) => Row[]`，`Row.badge` 只有 `'內建'` 或 `''` 兩種值；`editable`／`deletable` 語意不變

- [ ] **Step 1: 改寫失敗的測試**

`tests/view-manage.test.mjs`，第 7 行的 friend fixture 刪掉：

```js
const friend = { ...blankRun('朋友的'), origin: 'imported', from: '朋友A' };
```

第 9-11 行的「列出全部趟次」改成不含 friend、數量 7：

```js
test('列出全部趟次', () => {
  eq(buildList([...BASELINE, mine]).length, 7);
});
```

第 27-32 行的「朋友的可刪不可編輯，徽章帶來源」整條刪掉，換成：

```js
test('還原進來的趟沒有來源徽章', () => {
  const restored = { ...blankRun('還原的一趟'), origin: 'mine' };
  const row = buildList([restored])[0];
  eq(row.badge, '', '不該再出現「來自 XXX」');
  eq(row.editable, true);
  eq(row.deletable, true);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node tests/run.mjs`
Expected: FAIL，`列出全部趟次` 之類的斷言錯。（`還原進來的趟沒有來源徽章` 這條在舊程式其實會通過，因為 `origin: 'mine'` 本來就走 `''` 分支；真正會紅的是數量那條。）

- [ ] **Step 3: 簡化 `buildList`**

`js/view-manage.js` 第 12-14 行，把：

```js
    badge: r.origin === 'builtin' ? '內建'
         : r.origin === 'imported' ? `來自 ${r.from || '匿名'}`
         : '',
```

換成：

```js
    badge: r.origin === 'builtin' ? '內建' : '',
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS，全綠。

- [ ] **Step 5: Commit**

```bash
git add js/view-manage.js tests/view-manage.test.mjs
git commit -m "refactor: 趟次列表不再有「來自 XXX」徽章"
```

---

### Task 3: 備份／還原收進摺疊區

**Files:**
- Modify: `js/view-manage.js:25-98`（`mount`）、`js/view-manage.js:100-133`（`update`）
- Modify: `css/app.css:180-186`

**Interfaces:**
- Consumes: Task 1 的 `parseImport(text)` 單參數簽名
- Produces: 對外沒有新介面。`view-manage` 內部新增 module 層變數 `backupOpen: boolean`，記住 `<details>` 展開與否

**背景（實作前一定要懂）：** `act.mutate()` 會觸發整頁重繪，`update(state)` 把 `root.innerHTML` 整個換掉。所以 `<details>` 的展開狀態、以及使用者貼在 textarea 裡的內容，重繪後都會沒。原本的程式已經在處理 textarea（存檔失敗時把 `raw` 填回去），現在要多處理 `<details>`。`toggle` 事件**不會冒泡**，所以監聽器一定要用 capture 模式掛在 `root` 上，不能用一般的委派。

- [ ] **Step 1: 加上記住開合狀態的 module 變數與監聽器**

`js/view-manage.js` 第 23 行 `let lastState = null;` 下面加一行：

```js
let backupOpen = false;   // <details> 展開與否。整頁重繪會換掉 DOM，狀態得自己記
```

在 `mount` 裡（第 27 行 `act = actions;` 之後、`root.addEventListener('click', ...)` 之前）加：

```js
  // toggle 不冒泡，只能用 capture 攔
  root.addEventListener('toggle', e => {
    if (e.target.matches('details.backup')) backupOpen = e.target.open;
  }, true);
```

- [ ] **Step 2: 拿掉匯入時讀歸屬選擇的程式碼**

`js/view-manage.js` 的 `if (btn.id === 'im-go')` 區塊裡，第 63-68 行：

```js
      const raw = root.querySelector('#im-text').value;
      const text = raw.trim();
      const whose = root.querySelector('input[name="whose"]:checked').value;
      const from = root.querySelector('#im-from').value.trim();
      try {
        const incoming = parseImport(text, whose, from);
```

換成：

```js
      const raw = root.querySelector('#im-text').value;
      const text = raw.trim();
      try {
        const incoming = parseImport(text);
```

同區塊第 87 行的成功訊息，把「匯入」換成「還原」：

```js
          root.querySelector('#im-msg').textContent = `還原了 ${incoming.length} 趟。`;
```

第 90 行與第 94 行的失敗訊息同理：

```js
          root.querySelector('#im-msg').textContent = `還原失敗：${res.error}`;
```

```js
        root.querySelector('#im-msg').textContent = `還原失敗：${err.message}`;
```

第 48 行 `ex-copy` 的還原文案，要跟 Step 4 的新按鈕字對齊：

```js
      setTimeout(() => { btn.textContent = '複製備份內容'; }, 2000);
```

- [ ] **Step 3: 確認沒有殘留的舊 DOM 查詢**

Run: `grep -n "whose\|im-from" js/view-manage.js`
Expected: 沒有任何輸出。有輸出就是 Step 2 沒清乾淨，回去補。

- [ ] **Step 4: 改 `update` 的 HTML**

`js/view-manage.js` 第 113-132 行的 `root.innerHTML = ...` 整段換成：

```js
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
```

（原本的 `<h2>備份</h2>`、`<h2>匯入</h2>`、`.whose` 那三個 label 與 `#im-from` 全部消失。）

- [ ] **Step 5: 補 CSS，刪掉死規則**

`css/app.css` 第 180-186 行，把：

```css
#im-text { width:100%; padding:10px; font:inherit; color:var(--ink);
           background:transparent; border:1px solid var(--line); border-radius:8px }
.whose { display:grid; gap:8px; margin:10px 0 }
.whose label { display:flex; gap:8px; align-items:center; min-height:44px }
#im-from { padding:10px; font:inherit; color:var(--ink);
           background:transparent; border:1px solid var(--line); border-radius:8px }
#im-go { min-height:44px; padding:0 20px; border-radius:8px; font:inherit; cursor:pointer }
```

換成：

```css
#im-text { width:100%; padding:10px; font:inherit; color:var(--ink);
           background:transparent; border:1px solid var(--line); border-radius:8px }
#im-go { min-height:44px; padding:0 20px; border-radius:8px; font:inherit; cursor:pointer }

/* 備份／還原：預設收合的進階區 */
.backup { margin-top:30px; padding:0 12px 12px;
          border:1px solid var(--line); border-radius:10px }
.backup summary { min-height:44px; display:flex; align-items:center; cursor:pointer;
                  font-size:16px; font-weight:600; margin:0 -12px; padding:0 12px }
.backup[open] summary { border-bottom:1px solid var(--line); margin-bottom:12px }
```

- [ ] **Step 6: 跑測試**

Run: `node tests/run.mjs`
Expected: PASS。這個 task 沒動純函式，測試數量不變 —— 這一步是確認沒有手滑改壞 `buildList` 或 import。

- [ ] **Step 7: 在瀏覽器驗**

Run: `python -m http.server 8000`，開 `http://localhost:8000/`，切到「我的紀錄」分頁。

Expected:
- 頁面預設看到的是 `▸ 進階：備份與還原` 一行，展不開之前看不到 textarea
- 展開 → 「複製備份內容」「下載備份檔（.json）」「還原」都在，沒有「我自己的／朋友的」選項、沒有朋友名字欄位
- 展開狀態下新增或刪除一趟 → `<details>` 仍然是展開的（這就是 Step 1 在擋的東西）
- 貼一份備份按「還原」→ 訊息顯示「還原了 N 趟。」，列表多出來的趟沒有「來自 XXX」徽章
- 貼一段亂碼按「還原」→ 訊息是「還原失敗：資料格式不對，這不是一份備份內容」，而且貼的內容還留在框裡

- [ ] **Step 8: Commit**

```bash
git add js/view-manage.js css/app.css
git commit -m "feat: 備份與還原收進摺疊的進階區，介面不再出現 JSON 字樣"
```

---

### Task 4: 輸入表單搬到趟次列表上面

**Files:**
- Modify: `index.html:37-40`

**Interfaces:**
- Consumes: 無
- Produces: 無（純版面順序）

- [ ] **Step 1: 對調兩個容器**

`index.html` 第 37-40 行，把：

```html
  <section id="tab-manage" hidden>
    <div id="manage"></div>
    <div id="entry"></div>
  </section>
```

換成：

```html
  <section id="tab-manage" hidden>
    <div id="entry"></div>
    <div id="manage"></div>
  </section>
```

`js/main.js` 底部的 `register(...)` 呼叫順序**不用動** —— `register` 是照 id 抓既有節點，不是自己建節點，DOM 順序由 `index.html` 決定。

- [ ] **Step 2: 在瀏覽器驗**

Run: `python -m http.server 8000`，切到「我的紀錄」分頁。
Expected: 最上面是「新增一趟」按鈕（或展開中的表單），接著才是「趟次」列表，最底下是收合的「進階：備份與還原」。

- [ ] **Step 3: 跑測試**

Run: `node tests/run.mjs`
Expected: PASS，數量不變。

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style: 輸入表單移到趟次列表上面"
```

---

### Task 5: 首次進場落在輸入頁

**Files:**
- Modify: `js/main.js:129-131`（最底下的開機段）、`js/main.js:1-9`（import）

**Interfaces:**
- Consumes: `viewEntry.open(run)`、`viewEntry.nextRunName(runs)`（`js/view-entry.js` 既有 export）、`store.blankRun(name)`、`store.DRAFT_KEY`
- Produces: 無新 export

**背景：** 這段程式跑在模組頂層，天生只會執行一次，所以不需要額外的 flag 去擋重複觸發。重點是**不能放進 `render()`** —— 放進去的話使用者按「取消」關掉表單，下一次 render 又會被強制重開，變成關不掉的迴圈。

另外，`view-entry.update()` 在 `editing` 是 null 時會去撿草稿。如果已經有草稿，我們就不要先 `open()` 一個空白趟蓋掉它 —— 兩條路最後都會讓表單是展開的。

- [ ] **Step 1: 補 import**

`js/main.js` 第 7 行本來就有 `import * as viewEntry from './view-entry.js';`，不用改。確認第 2 行的 `import * as store from './store.js';` 也在（`store.blankRun`、`store.DRAFT_KEY` 都從這裡拿）。

- [ ] **Step 2: 改開機段**

`js/main.js` 最後三行：

```js
recompute();
render();
```

換成：

```js
recompute();

// 一趟都還沒有的新使用者：直接落在輸入頁，表單展開，不用自己找入口。
// 只在開機跑一次 —— 放進 render() 的話，使用者按「取消」會被立刻強制重開。
const noRunsYet = state.runs.every(r => r.origin === 'builtin');
if (noRunsYet) {
  state.tab = 'manage';
  // 有草稿就交給 view-entry 自己撿回來，別用空白表單蓋掉
  const hasDraft = !!storage.getItem(store.DRAFT_KEY);
  if (!hasDraft) viewEntry.open(store.blankRun(viewEntry.nextRunName(state.runs)));
}

render();
```

- [ ] **Step 3: 在瀏覽器驗（全新使用者）**

Run: `python -m http.server 8000`，開無痕視窗或先在 devtools console 執行
`localStorage.clear()` 再重新整理。

Expected:
- 一進來就在「我的紀錄」分頁，20 格輸入表單已經展開
- 趟次名稱預設 `LV6 7th`（內建 6 趟，所以下一趟是第 7）
- 按「取消」→ 表單收起來變回「新增一趟」按鈕，而且**不會自己再打開**
- 切到「統計」再切回來 → 一樣不會自己打開

- [ ] **Step 4: 在瀏覽器驗（已有紀錄）**

存一趟之後重新整理。
Expected: 落在「統計」分頁，不是輸入頁。

- [ ] **Step 5: 在瀏覽器驗（有草稿）**

`localStorage.clear()` → 重整 → 在表單裡打幾個分數但**不要存檔** → 重整。
Expected: 落在輸入頁，而且看到的是剛才打的那些分數，不是空白表單。

- [ ] **Step 6: 跑測試**

Run: `node tests/run.mjs`
Expected: PASS，數量不變。

- [ ] **Step 7: Commit**

```bash
git add js/main.js
git commit -m "feat: 還沒有紀錄的使用者一進來就在輸入頁"
```

---

### Task 6: 存檔成功後跳到統計分頁

**Files:**
- Modify: `js/main.js:42-47`（`actions`）
- Modify: `js/view-entry.js:109-122`（`commit`）

**Interfaces:**
- Consumes: `main.js` 既有的 `export function setTab(t)`
- Produces: `actions.setTab(tab: 'stats'|'manage') => void`，供 view 模組切分頁用

- [ ] **Step 1: 把 `setTab` 掛進 actions**

`js/main.js` 第 42-47 行的 `actions` 物件：

```js
const actions = {
  mutate,                  // function 宣告會提升，這裡取得到
  rerender: () => render(),
  openEntry: null,         // Task 9 註冊 view-entry 時填入
  toggleRun                // 給 view-runs 用，切換某趟在圖表/分布圖裡的顯示與否
};
```

換成：

```js
const actions = {
  mutate,                  // function 宣告會提升，這裡取得到
  rerender: () => render(),
  openEntry: null,         // Task 9 註冊 view-entry 時填入
  toggleRun,               // 給 view-runs 用，切換某趟在圖表/分布圖裡的顯示與否
  setTab                   // 給 view-entry 用，存檔成功後把使用者送去看圖
};
```

- [ ] **Step 2: 改 `commit`**

`js/view-entry.js` 第 109-122 行的 `commit()`，把結尾三行：

```js
  if (!res.ok) return;
  editing = null;
  clearDraft();
  render();
}
```

換成：

```js
  if (!res.ok) return;
  editing = null;
  clearDraft();
  // 存好了就把人送去統計分頁，讓他馬上看到自己那條線。
  // setTab 內部會 render()，所以這裡不用再叫一次。
  // 失敗時（上面已經 return）不切 —— 橫幅在原本那頁，切走就看不到了。
  act.setTab('stats');
}
```

- [ ] **Step 3: 在瀏覽器驗**

Run: `python -m http.server 8000`

Expected:
- 新增一趟，隨便填幾格分數，按「存檔」→ 自動切到「統計」分頁，折線圖上多一條新的線
- 存檔失敗的情況（devtools console 執行
  `Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }` 之後再按存檔）
  → **停在「我的紀錄」分頁**，最上方橫幅顯示「存不進去…建議先匯出備份」，表單內容還在
- 從趟次列表按「編輯」改一趟再存 → 一樣跳到統計分頁

- [ ] **Step 4: 跑測試**

Run: `node tests/run.mjs`
Expected: PASS，數量不變。

- [ ] **Step 5: Commit**

```bash
git add js/main.js js/view-entry.js
git commit -m "feat: 存檔成功後自動跳到統計分頁"
```

---

### Task 7: 文件與註解同步

**Files:**
- Modify: `js/stats.js:9-12`
- Modify: `README.md:6-7`、`README.md:13-15`

**Interfaces:**
- Consumes: 無
- Produces: 無

- [ ] **Step 1: 修 `stats.js` 過期的註解**

`js/stats.js` 第 9-12 行：

```js
/**
 * 平均基準：自己的趟數滿 2 趟才用自己的，否則退回內建 6 趟。
 * imported（朋友的）永不計入。
 */
```

換成：

```js
/**
 * 平均基準：自己的趟數滿 2 趟才用自己的，否則退回內建 6 趟。
 * origin 只有 builtin 與 mine 兩種，內建的不計入自己的平均。
 */
```

- [ ] **Step 2: 修 `README.md`**

第 6-7 行：

```markdown
**資料只存在你自己的瀏覽器**，沒有帳號、沒有後端、不會上傳到任何地方。
換裝置請用「我的紀錄」分頁的「備份」把 JSON 匯出再匯入。
```

換成：

```markdown
**資料只存在你自己的瀏覽器**，沒有帳號、沒有後端、不會上傳到任何地方。
你跟別人各自記各自的，互相看不到。換裝置請用「我的紀錄」分頁最下面的
「進階：備份與還原」下載備份，到新裝置貼回去。
```

第 13-15 行：

```markdown
「統計」分頁看走勢、每輪明細、分數分布；「我的紀錄」分頁新增/編輯/刪除自己的紀錄，
以及匯出匯入備份。輸入分數時工具會用官方對照表自動反推遺物，同分數對到多顆遺物時
（例如力／敏／智三選一）用候選 chip 手動選一顆消歧。
```

換成：

```markdown
第一次開頁面會直接落在「我的紀錄」分頁的輸入表單，由上往下填 20 個檢查點的分數，
按「存檔」就跳到「統計」分頁看走勢、每輪明細與分數分布。輸入分數時工具會用官方
對照表自動反推遺物，同分數對到多顆遺物時（例如力／敏／智三選一）用候選 chip
手動選一顆消歧。備份與還原收在「我的紀錄」分頁最下面的摺疊區。
```

- [ ] **Step 3: 跑測試**

Run: `node tests/run.mjs`
Expected: PASS。

- [ ] **Step 4: 走一次驗收清單**

Run: `python -m http.server 8000`，devtools console 執行 `localStorage.clear()` 後重整。

逐項確認 spec 的驗收條件：
- 全新瀏覽器 → 直接看到展開的輸入表單
- 打完一趟按存檔 → 自動跳到統計分頁，圖上多一條自己的線
- 整個頁面找不到「JSON」字樣，唯一例外是「下載備份檔（.json）」按鈕
- 展開「進階：備份與還原」→ 下載、還原都正常
- 還原一份備份 → 進來的趟都可編輯可刪、沒有「來自 XXX」badge

- [ ] **Step 5: Commit**

```bash
git add js/stats.js README.md
git commit -m "docs: 說明文件與註解同步拿掉共享的描述"
```

---

## Self-Review

**Spec coverage**

| Spec 段落 | 對應 task |
|---|---|
| 一、拿掉「朋友的」— `parseImport` 簡化 | Task 1 |
| 一、`load` 相容舊 `imported` | Task 1 |
| 一、`view-manage` 刪 radio 與 `#im-from` | Task 3 |
| 一、`buildList` 刪來源 badge | Task 2 |
| 一、`stats.js` 註解 | Task 7 |
| 一、測試異動 | Task 1、Task 2 |
| 二、備份收進 `<details>`、文案改寫 | Task 3 |
| 三、首次進場落在輸入頁 | Task 5 |
| 四、`#entry` 與 `#manage` 對調 | Task 4 |
| 五、存檔後跳統計、`actions.setTab` | Task 6 |
| 影響範圍表的 `css/app.css` | Task 3 |
| 影響範圍表的 `README.md` | Task 7 |
| 驗收清單 | Task 7 Step 4 |

沒有缺口。

**Placeholder scan**：無 TBD／TODO，每個 code step 都有可以直接貼的完整程式碼。

**Type consistency**：`parseImport(text)` 在 Task 1 定義、Task 3 使用，單參數一致。`backupOpen` 在 Task 3 內部宣告與使用。`actions.setTab` 在 Task 6 Step 1 掛上、Step 2 使用。`stripImported` 只在 `store.js` 內部用，不 export。`viewEntry.open` / `viewEntry.nextRunName` 都是 `view-entry.js` 既有的 export（第 37、29 行），Task 5 只是呼叫。
