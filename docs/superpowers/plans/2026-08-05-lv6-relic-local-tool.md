# 遺跡 LV6 遺物紀錄工具本地化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `lv6-relic-scores.html`（單檔、資料硬編碼）改成任何人都能打開網址、輸入自己的 LV6 紀錄、存在自己瀏覽器的靜態網站。

**Architecture:** 原生 ES module 多檔，無建置。純資料層（`config` / `official` / `baseline`）→ 純函式層（`decode` / `stats` / `store`）→ 視圖層（`view-*`）→ `main.js` 持有 state 並調度。視圖之間互不呼叫，只認 state。

**Tech Stack:** 原生 ES module、Chart.js（vendor 檔）、node 內建 test 執行器（零依賴）、GitHub Pages。

## Global Constraints

- **無建置**：不得引入 npm 套件、bundler、CSS 框架。`package.json` 只能有 `{"type":"module","private":true}`，不得有 `dependencies`
- **只做 LV6**：關卡序列寫死，不做其他難度
- **語言**：所有介面文案、註解、commit 訊息用繁體中文
- **遺物名稱與效果描述照官方原字串**，不得自行翻譯、簡化或改標點
- **路徑一律相對**（`./js/main.js`），不得用絕對路徑，否則 GitHub Pages 子路徑會 404
- **資料模型**：每趟固定 20 格 `cells`，`{ score: number, target: string|null }`。級距／正負／類型-屬性一律由 `decode` 從分數推導，**不得另存欄位**
- **index 19（100% 魔王兔兔）**：`score` 恆為 0、`target` 恆為 `null`、不可編輯
- **md 第六節的「待確認事項」不得寫成程式規則**（光暗屬性從未出現、正向類型 0/25、負向屬性偏少）—— 那是樣本不足的觀察
- 測試指令固定為 `node tests/run.mjs`，必須零依賴

---

## 檔案結構

| 路徑 | 職責 | 依賴 |
|---|---|---|
| `package.json` | 只為了讓 node 把 `.js` 當 ES module | 無 |
| `index.html` | 版面骨架、兩個分頁的容器 | 無 |
| `css/base.css` | CSS 變數、深色模式、中文排版 | 無 |
| `css/app.css` | 版面與元件樣式 | `base.css` |
| `js/config.js` | LV6 常數：`PROG` / `STAGE` / `FRONT` / `BONUS` / `MULT` / `CELLS` / `BOSS_INDEX` | 無 |
| `js/official.js` | 官方遺物表 `RELICS`、`TYPE_TARGETS`、`ELEM_TARGETS` | 無 |
| `js/baseline.js` | 作者 6 趟，唯讀，`origin: 'builtin'` | `config.js` |
| `js/decode.js` | 分數 → `{grade, sign, kind, candidates, effects, ok}` | `official.js` |
| `js/stats.js` | 純函式統計：小計、總分、平均基準、差距、累積、分組 | `config.js` |
| `js/store.js` | localStorage 讀寫、驗證、匯出匯入、訂閱 | `config.js` |
| `js/view-chart.js` | 折線圖 | `config` `stats` `decode` |
| `js/view-detail.js` | 每輪明細表 | `config` `stats` `decode` |
| `js/view-dist.js` | 分數分布 | `official` `decode` |
| `js/view-entry.js` | 輸入／編輯表單 | `config` `decode` `store` |
| `js/view-manage.js` | 趟次清單、匯出匯入 | `store` `stats` |
| `js/main.js` | 合併 baseline 與 store 成 state、訂閱、調度各 view | 全部 |
| `vendor/chart.umd.js` | Chart.js | 無 |
| `tests/harness.mjs` | 極簡斷言工具 | 無 |
| `tests/run.mjs` | 測試入口，import 各 `*.test.mjs` | 全部測試檔 |

---

## Task 1: 專案骨架與第一條測試（分數帶不重疊）

這條測試是整個「打分數自動推導」設計的前提。它掛了，輸入方式就得改成完整下拉選單，後面九個 Task 全部要重寫。所以先驗它。

**Files:**
- Create: `package.json`
- Create: `js/config.js`
- Create: `js/official.js`
- Create: `tests/harness.mjs`
- Create: `tests/run.mjs`
- Create: `tests/official.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces:
  - `config.js`：`PROG: string[20]`、`STAGE: string[20]`、`FRONT: number[4]`、`BONUS: 1800`、`MULT: 5`、`CELLS: 20`、`BOSS_INDEX: 19`
  - `official.js`：`RELICS: Record<string, [number, string, string][]>`（鍵為 `"級距|正負|類型或屬性"`）、`TYPE_TARGETS: ['力','敏','智']`、`ELEM_TARGETS: ['火','水','木','光','暗']`
  - `harness.mjs`：`test(name, fn)`、`eq(actual, expected, msg?)`、`ok(cond, msg)`、`report(): number`

- [ ] **Step 1: 建立 package.json**

無建置的唯一例外。node 需要它才會把 `js/*.js` 當 ES module 讀；沒有它就得把副檔名改成 `.mjs`，而 GitHub Pages 對 `.mjs` 的 MIME 對應不可靠，瀏覽器會拒載。零 dependencies，不需要 `npm install`。

```json
{
  "name": "lr-maze-statistic",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node tests/run.mjs"
  }
}
```

- [ ] **Step 2: 建立測試工具**

`tests/harness.mjs`：

```js
// 極簡斷言工具。零依賴，不用 node:test，輸出自己控制。
const failures = [];
let passed = 0;

export function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push({ name, message: e.message });
  }
}

export function ok(cond, msg) {
  if (!cond) throw new Error(msg || '斷言失敗');
}

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || '值不相等'}：預期 ${b}，實得 ${a}`);
}

export function report() {
  for (const f of failures) console.error(`  ✗ ${f.name}\n      ${f.message}`);
  const line = `${passed} 通過，${failures.length} 失敗`;
  console.log(failures.length ? `\n${line}` : `\n✓ ${line}`);
  return failures.length;
}
```

`tests/run.mjs`：

```js
import { report } from './harness.mjs';
import './official.test.mjs';

process.exit(report() ? 1 : 0);
```

- [ ] **Step 3: 寫失敗的測試**

`tests/official.test.mjs`：

```js
import { test, ok, eq } from './harness.mjs';
import { RELICS } from '../js/official.js';

test('RELICS 有十二組', () => {
  eq(Object.keys(RELICS).length, 12, '組數不對');
});

test('十二組分數帶兩兩不相交', () => {
  const bands = Object.entries(RELICS)
    .map(([key, rows]) => {
      const scores = rows.map(r => r[0]);
      return { key, min: Math.min(...scores), max: Math.max(...scores) };
    })
    .sort((a, b) => a.min - b.min);

  for (let i = 1; i < bands.length; i++) {
    const prev = bands[i - 1], cur = bands[i];
    ok(cur.min > prev.max,
      `${prev.key}(最高 ${prev.max}) 與 ${cur.key}(最低 ${cur.min}) 重疊`);
  }
});

test('每個分數在全表唯一', () => {
  const seen = new Map();
  for (const [key, rows] of Object.entries(RELICS)) {
    for (const [score] of rows) {
      ok(!seen.has(score), `分數 ${score} 同時出現在 ${seen.get(score)} 與 ${key}`);
      seen.set(score, key);
    }
  }
  eq(seen.size, 94, '相異分數總數不對');
});

test('每筆都是 [分數, 名稱, 效果] 三元組', () => {
  for (const [key, rows] of Object.entries(RELICS)) {
    for (const row of rows) {
      eq(row.length, 3, `${key} 有一筆長度不是 3`);
      ok(typeof row[0] === 'number', `${key} 的分數不是數字`);
      ok(row[1].length > 0, `${key} 有一筆名稱是空的`);
    }
  }
});

// LV6遺物分數分析.md 第 2.2 節的公式：
//   類型：C = 3j、B = 10j、A = 22j
//   正向·屬性：C = 150 + 1.5j、B = 500 + 5j、A = 1100 + 11j
//   負向·屬性：C = 201 + 1j、B = 650 + 3.5j、A = 1430 + 7.7j
// 同組的類型與屬性兩份表遺物順序一致，所以可以由類型分數反推效果權重 j，
// 再用公式算出屬性分數來對帳。對得上就表示官方表符合單一公式。
const TYPE_BASE = { C: 3, B: 10, A: 22 };
const ELEM_FORMULA = {
  'C|正': j => 150 + 1.5 * j,   'C|負': j => 201 + 1 * j,
  'B|正': j => 500 + 5 * j,     'B|負': j => 650 + 3.5 * j,
  'A|正': j => 1100 + 11 * j,   'A|負': j => 1430 + 7.7 * j
};

test('官方表符合 md 第 2.2 節的計分公式', () => {
  for (const grade of ['C', 'B', 'A']) {
    for (const sign of ['正', '負']) {
      const types = RELICS[`${grade}|${sign}|類型`];
      const elems = RELICS[`${grade}|${sign}|屬性`];
      eq(types.length, elems.length, `${grade}|${sign} 兩份表筆數不一致`);

      types.forEach(([typeScore, name], i) => {
        const j = typeScore / TYPE_BASE[grade];
        ok(Number.isInteger(j), `${name} 的權重 j=${j} 不是整數`);
        eq(elems[i][1], name, `${grade}|${sign} 第 ${i + 1} 筆遺物順序對不上`);
        eq(elems[i][0], Math.round(ELEM_FORMULA[`${grade}|${sign}`](j)),
           `${name}（${grade} 級 ${sign}向）的屬性分數與公式不符`);
      });
    }
  }
});
```

- [ ] **Step 4: 執行測試確認失敗**

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/official.js'`

- [ ] **Step 5: 建立 config.js**

值全部照抄 `lv6-relic-scores.html:147-150`：

```js
// LV6 常數。關卡序列寫死，本工具只做 LV6。
export const PROG = ['5%','10%','15%','20%','25%','30%','35%','40%','45%','50%',
                     '55%','60%','65%','70%','75%','80%','85%','90%','95%','100%'];

export const STAGE = ['單線','混線','雙線','單線','雙線','正面C級','混線(禁火)','雙線(禁水)',
                      '混線','正面B級','雙線','混線','雙線(禁敏捷)','正面B級','雙線',
                      '混線(禁火)','混線(禁力量)','正面A級','雙線(禁光)','魔王兔兔'];

/** 正面關的 index：30% / 50% / 70% / 90%，只掉正向遺物 */
export const FRONT = [5, 9, 13, 17];

/** 「無使用道具」固定加分 */
export const BONUS = 1800;

/** 總分 =（遺物分數總和 + BONUS）× MULT */
export const MULT = 5;

export const CELLS = 20;

/** 100% 魔王兔兔，沒有遺物，分數固定 0 */
export const BOSS_INDEX = 19;
```

- [ ] **Step 6: 建立 official.js**

把 `lv6-relic-scores.html:195-196` 的 `TYPES` 與 `RELICS` 整段搬過來。`RELICS` 是單行 JSON 物件，原封不動複製，**一個字元都不要改** —— 名稱與效果字串必須跟官方一致。搬完後加上 export 與目標常數：

```js
// 官方遺物分數表。來源 github.com/mti0224/rangerbook
//   res/labyrinth_artifact.json（437 筆）+ res/迷宮遺物.json（55 筆）
// 鍵為「級距|正負|類型或屬性」，值為 [分數, 名稱, 效果] 陣列。
// 同分的遺物名稱以「／」併在同一筆，效果以「 ／ 」併。
// 分數是固定值不是隨機：級距 × 正負向 × 類型或屬性 × 效果 就決定了分數。
export const RELICS = { /* ← 自 lv6-relic-scores.html:196 原封不動搬入 */ };

/** 類型遺物的三個目標 */
export const TYPE_TARGETS = ['力', '敏', '智'];

/** 屬性遺物的五個目標 */
export const ELEM_TARGETS = ['火', '水', '木', '光', '暗'];
```

- [ ] **Step 7: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— `✓ 5 通過，0 失敗`

若「分數帶兩兩不相交」失敗，**停下來回報**。整份計畫的輸入設計建立在這條之上。

- [ ] **Step 8: Commit**

```bash
git add package.json js/config.js js/official.js tests/
git commit -m "test: 驗證十二組分數帶不重疊，搬入官方遺物表與 LV6 常數"
```

---

## Task 2: decode.js —— 分數反推遺物結構

**Files:**
- Create: `js/decode.js`
- Create: `tests/decode.test.mjs`
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `official.js` 的 `RELICS`、`TYPE_TARGETS`、`ELEM_TARGETS`
- Produces:
  - `decode(score: number) => { ok: true, grade: 'A'|'B'|'C', sign: '正'|'負', kind: '類型'|'屬性', candidates: string[], effects: string[] } | { ok: false }`
  - `targetOptions(kind: string) => string[]`
  - `label(score: number) => string`（給圖表 tooltip 用的短字串，如 `腐爛的尾巴 等3種`）

- [ ] **Step 1: 寫失敗的測試**

`tests/decode.test.mjs`：

```js
import { test, ok, eq } from './harness.mjs';
import { RELICS } from '../js/official.js';
import { decode, targetOptions, label } from '../js/decode.js';

test('全表 94 筆都能反推回正確的組別', () => {
  for (const [key, rows] of Object.entries(RELICS)) {
    const [grade, sign, kind] = key.split('|');
    for (const [score] of rows) {
      const d = decode(score);
      ok(d.ok, `分數 ${score} 查不到`);
      eq([d.grade, d.sign, d.kind], [grade, sign, kind], `分數 ${score} 反推錯誤`);
    }
  }
});

test('查無此分數回傳 ok:false', () => {
  eq(decode(999).ok, false);
  eq(decode(0).ok, false);
});

test('同分遺物拆成多個候選', () => {
  const d = decode(1200);
  eq(d.candidates, ['感染的樹液', '腐爛的尾巴', '詛咒的咒文書']);
  eq(d.effects.length, 3, '效果數應與候選數一致');
});

test('單一遺物候選只有一個', () => {
  const d = decode(2684);
  eq(d.candidates, ['可疑的藥丸']);
  eq(d.effects.length, 1);
});

test('候選數與效果數永遠一致', () => {
  for (const rows of Object.values(RELICS)) {
    for (const [score] of rows) {
      const d = decode(score);
      eq(d.candidates.length, d.effects.length, `分數 ${score} 的候選與效果數不一致`);
    }
  }
});

test('targetOptions 依 kind 給對的選項', () => {
  eq(targetOptions('類型'), ['力', '敏', '智']);
  eq(targetOptions('屬性'), ['火', '水', '木', '光', '暗']);
});

test('label 對同分遺物加上「等N種」', () => {
  eq(label(1200), '感染的樹液 等3種');
  eq(label(2684), '可疑的藥丸');
  eq(label(999), '');
});
```

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加一行 `import './decode.test.mjs';`（放在 `official.test.mjs` 之後、`process.exit` 之前）。

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/decode.js'`

- [ ] **Step 3: 實作 decode.js**

```js
import { RELICS, TYPE_TARGETS, ELEM_TARGETS } from './official.js';

/**
 * 分數 → 遺物結構。
 * 十二組分數帶兩兩不相交（見 tests/official.test.mjs），
 * 所以分數可唯一決定級距、正負、類型或屬性。
 * 推不出來的只有「力/敏/智哪一個」或「火/水/木/光/暗哪一個」
 * —— 公式裡目標種類不影響分數，那部分由使用者自己選。
 */
export function decode(score) {
  for (const [key, rows] of Object.entries(RELICS)) {
    const hit = rows.find(r => r[0] === score);
    if (!hit) continue;
    const [grade, sign, kind] = key.split('|');
    return {
      ok: true,
      grade, sign, kind,
      candidates: hit[1].split('／'),
      effects: hit[2].split(' ／ ')
    };
  }
  return { ok: false };
}

export const targetOptions = kind =>
  kind === '類型' ? TYPE_TARGETS : ELEM_TARGETS;

/** 圖表 tooltip 用的短標籤 */
export function label(score) {
  const d = decode(score);
  if (!d.ok) return '';
  return d.candidates.length > 1
    ? `${d.candidates[0]} 等${d.candidates.length}種`
    : d.candidates[0];
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 12 通過，0 失敗

- [ ] **Step 5: Commit**

```bash
git add js/decode.js tests/
git commit -m "feat: 加入 decode，由分數反推級距、正負與遺物候選"
```

---

## Task 3: baseline.js 與 stats.js

**Files:**
- Create: `js/baseline.js`
- Create: `js/stats.js`
- Create: `tests/stats.test.mjs`
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `config.js` 的 `CELLS`、`BONUS`、`MULT`
- Produces:
  - `baseline.js`：`BASELINE: Run[]`，每筆 `{ id, name, note, origin: 'builtin', createdAt, cells }`
  - `stats.js`：
    - `subtotal(run) => number`
    - `total(run) => number`
    - `meanBasis(runs) => { runs: Run[], source: 'mine'|'builtin' }`
    - `meanByCheckpoint(runs) => number[20]`
    - `deviation(run, mean) => number[20]`
    - `cumulative(run, mean) => number[20]`
    - `groupStats(runs) => Array<{ key, n, min, mean, max }>`

- [ ] **Step 1: 寫失敗的測試**

`tests/stats.test.mjs`：

```js
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

test('imported 不計入平均基準', () => {
  const runs = [...BASELINE,
    mkRun('a', flat(1)),
    mkRun('friend1', flat(9), 'imported'),
    mkRun('friend2', flat(9), 'imported')];
  eq(meanBasis(runs).source, 'builtin', 'imported 不該讓基準切到 mine');
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
```

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加 `import './stats.test.mjs';`

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/baseline.js'`

- [ ] **Step 3: 建立 baseline.js**

從 `lv6-relic-scores.html:152-171` 的 `RUNS` 轉檔。舊格式是 `s:[分數]` + `r:['負C敏']` 兩個平行陣列；新格式把分數放 `cells[i].score`，並從舊代號取**最後一個字**當 `target`（`'負C敏'` → `'敏'`、`'正A水'` → `'水'`、`'—'` → `null`）。級距與正負不再存，由 `decode` 推。

`note` 照 md 第 3.1 節的備註填入。

```js
import { CELLS } from './config.js';

/**
 * 作者的六趟 LV6 紀錄，唯讀基準線。
 * 自 lv6-relic-scores.html 的 const RUNS 轉檔而來：
 * 舊格式的遺物代號（如「負C敏」）只取最後一字當 target，
 * 級距與正負一律由 decode 從分數推導，避免兩邊不一致。
 */
const raw = [
  ['LV6 1st', '',
   [342,351,351,348,1140,278,1070,940,1120,935,1140,1200,2552,900,2508,2292,2574,2002,2596,0],
   ['敏','敏','敏','敏','敏','木','水','水','力','水','敏','力','智','木','力','水','智','水','敏',null]],
  ['LV6 2nd', '',
   [342,336,351,336,1120,272,1160,1200,1160,910,1120,1140,2464,910,2339,2640,2464,1980,2508,0],
   ['力','敏','智','智','敏','木','智','智','力','火','力','敏','敏','火','水','力','智','水','智',null]],
  ['LV6 3rd', '',
   [360,317,348,342,1200,278,1140,1140,1120,905,1160,1140,2574,925,2508,2574,2339,2035,2640,0],
   ['智','木','力','智','智','水','力','力','智','火','力','智','力','火','敏','敏','木','火','力',null]],
  ['LV6 4th', '75% 開始坐牢',
   [342,360,354,351,1170,272,1170,1180,1170,900,1170,1160,2596,910,2596,2640,2323,2035,2596,0],
   ['力','智','智','敏','智','火','力','敏','智','木','敏','力','智','木','智','敏','水','水','智',null]],
  ['LV6 5th', '60% 開始坐牢',
   [360,354,360,348,1160,278,1140,1120,1140,900,1180,1170,2596,900,2552,2596,2323,2002,2640,0],
   ['力','智','敏','力','敏','水','力','力','力','火','智','力','敏','木','力','智','火','火','力',null]],
  ['LV6 6th', '60% 開始坐牢',
   [351,342,360,342,1120,281,1120,1160,1200,900,1200,1120,2552,925,2574,2574,2292,1980,2464,0],
   ['敏','力','力','敏','智','火','智','敏','智','木','敏','敏','智','火','智','敏','木','火','敏',null]]
];

export const BASELINE = raw.map(([name, note, scores, targets], i) => ({
  id: `builtin_${i + 1}`,
  name,
  note,
  origin: 'builtin',
  createdAt: '',
  cells: Array.from({ length: CELLS }, (_, j) => ({
    score: scores[j],
    target: targets[j]
  }))
}));
```

- [ ] **Step 4: 建立 stats.js**

```js
import { CELLS, BONUS, MULT } from './config.js';
import { decode } from './decode.js';

export const subtotal = run => run.cells.reduce((a, c) => a + c.score, 0);

/** 總分 =（遺物分數總和 + 1800）× 5 */
export const total = run => (subtotal(run) + BONUS) * MULT;

/**
 * 平均基準：自己的趟數滿 2 趟才用自己的，否則退回內建 6 趟。
 * imported（朋友的）永不計入。
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
```

- [ ] **Step 5: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 26 通過，0 失敗

「baseline 六趟總分符合 md 紀錄」若失敗，代表轉檔時分數抄錯，逐格比對 `lv6-relic-scores.html:152-171`。

- [ ] **Step 6: Commit**

```bash
git add js/baseline.js js/stats.js tests/
git commit -m "feat: 加入 baseline 轉檔與 stats 純函式統計"
```

---

## Task 4: store.js —— 持久化、驗證、匯出匯入

`store` 不認識 `builtin`。合併 baseline 是 `main.js` 的事。所有函式接受 `storage` 參數（而非直接抓 `localStorage`），測試才能餵假的。

**Files:**
- Create: `js/store.js`
- Create: `tests/store.test.mjs`
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `config.js` 的 `CELLS`、`BOSS_INDEX`
- Produces:
  - `KEY: 'lr-maze-lv6/v1'`、`DRAFT_KEY: 'lr-maze-lv6/draft'`、`BROKEN_KEY: 'lr-maze-lv6/v1.broken'`、`SCHEMA: 1`
  - `blankRun(name: string) => Run`
  - `validate(data: unknown) => void`（不合格則 throw，訊息為中文）
  - `load(storage) => { runs: Run[], warning: string|null }`
  - `save(storage, runs: Run[]) => { ok: boolean, error: string|null }`
  - `exportText(runs: Run[]) => string`
  - `parseImport(text: string, origin: 'mine'|'imported', from?: string) => Run[]`
  - `memoryStorage() => Storage`（localStorage 被禁時的替身，也給測試用）

- [ ] **Step 1: 寫失敗的測試**

`tests/store.test.mjs`：

```js
import { test, ok, eq } from './harness.mjs';
import { CELLS } from '../js/config.js';
import { KEY, BROKEN_KEY, SCHEMA, blankRun, validate, load, save,
         exportText, parseImport, memoryStorage } from '../js/store.js';

const mkRun = (name, origin = 'mine') => ({
  ...blankRun(name), origin
});

test('blankRun 產生 20 格全 0', () => {
  const r = blankRun('LV6 7th');
  eq(r.cells.length, CELLS);
  eq(r.name, 'LV6 7th');
  eq(r.origin, 'mine');
  ok(r.cells.every(c => c.score === 0 && c.target === null), '應該全是 0 與 null');
  ok(r.id.startsWith('r_'), 'id 前綴不對');
});

test('blankRun 的 id 不重複', () => {
  const ids = new Set(Array.from({ length: 50 }, () => blankRun('x').id));
  eq(ids.size, 50, 'id 撞號');
});

test('存讀往返', () => {
  const s = memoryStorage();
  const runs = [mkRun('A'), mkRun('B')];
  eq(save(s, runs).ok, true);
  eq(load(s).runs.map(r => r.name), ['A', 'B']);
});

test('空 storage 讀出空陣列', () => {
  eq(load(memoryStorage()).runs, []);
});

test('壞掉的 JSON 不清空，備份到 .broken', () => {
  const s = memoryStorage();
  s.setItem(KEY, '{壞掉的');
  const res = load(s);
  eq(res.runs, []);
  ok(res.warning, '應該要有警告訊息');
  eq(s.getItem(BROKEN_KEY), '{壞掉的', '原始資料應該備份下來');
});

test('schema 版本比程式新則拒絕載入', () => {
  const s = memoryStorage();
  s.setItem(KEY, JSON.stringify({ v: SCHEMA + 1, runs: [] }));
  const res = load(s);
  eq(res.runs, []);
  ok(res.warning.includes('新'), `警告訊息應提到版本較新，實得：${res.warning}`);
});

test('validate 擋掉格數不對的趟', () => {
  const bad = { v: SCHEMA, runs: [{ ...blankRun('X'), cells: [{ score: 1, target: null }] }] };
  let threw = null;
  try { validate(bad); } catch (e) { threw = e.message; }
  ok(threw, '應該要 throw');
  ok(threw.includes('X'), `訊息應指出是哪一趟，實得：${threw}`);
});

test('validate 擋掉非數字分數', () => {
  const r = blankRun('Y');
  r.cells[3] = { score: '342', target: null };
  let threw = null;
  try { validate({ v: SCHEMA, runs: [r] }); } catch (e) { threw = e.message; }
  ok(threw, '應該要 throw');
  ok(threw.includes('4'), `訊息應指出第 4 格，實得：${threw}`);
});

test('匯出只含自己的趟', () => {
  const runs = [mkRun('我的'), mkRun('朋友的', 'imported')];
  const out = JSON.parse(exportText(runs));
  eq(out.runs.map(r => r.name), ['我的']);
  eq(out.v, SCHEMA);
});

test('匯入標成 imported 並記來源', () => {
  const text = exportText([mkRun('他的一趟')]);
  const got = parseImport(text, 'imported', '朋友A');
  eq(got.length, 1);
  eq(got[0].origin, 'imported');
  eq(got[0].from, '朋友A');
});

test('匯入自己的資料不帶 from', () => {
  const text = exportText([mkRun('備份')]);
  const got = parseImport(text, 'mine');
  eq(got[0].origin, 'mine');
  eq(got[0].from, undefined);
});

test('匯入壞資料時 throw 中文訊息', () => {
  let threw = null;
  try { parseImport('不是 JSON', 'mine'); } catch (e) { threw = e.message; }
  ok(threw, '應該要 throw');
  ok(threw.includes('格式'), `訊息應提到格式，實得：${threw}`);
});

test('storage 寫入失敗時 save 回報而不炸掉', () => {
  const s = memoryStorage();
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  const res = save(s, [mkRun('A')]);
  eq(res.ok, false);
  ok(res.error, '應該要有錯誤訊息');
});
```

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加 `import './store.test.mjs';`

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/store.js'`

- [ ] **Step 3: 實作 store.js**

```js
import { CELLS } from './config.js';

export const KEY = 'lr-maze-lv6/v1';
export const DRAFT_KEY = 'lr-maze-lv6/draft';
export const BROKEN_KEY = 'lr-maze-lv6/v1.broken';
export const SCHEMA = 1;

/** localStorage 被禁（無痕模式）時的替身，也給測試用 */
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: k => void map.delete(k)
  };
}

let seq = 0;
export function blankRun(name) {
  return {
    id: `r_${Date.now()}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    note: '',
    origin: 'mine',
    createdAt: new Date().toISOString(),
    cells: Array.from({ length: CELLS }, () => ({ score: 0, target: null }))
  };
}

/** 不合格則 throw，訊息指出壞在哪一趟哪一格 */
export function validate(data) {
  if (!data || typeof data !== 'object') throw new Error('資料格式不對，不是物件');
  if (typeof data.v !== 'number') throw new Error('資料格式不對，缺少版本號');
  if (!Array.isArray(data.runs)) throw new Error('資料格式不對，runs 不是陣列');

  for (const run of data.runs) {
    const who = run && run.name ? `「${run.name}」` : '某一趟';
    if (!run || typeof run !== 'object') throw new Error(`${who} 不是物件`);
    if (!Array.isArray(run.cells) || run.cells.length !== CELLS)
      throw new Error(`${who} 應該有 ${CELLS} 格，實得 ${run.cells ? run.cells.length : 0} 格`);
    run.cells.forEach((cell, i) => {
      if (!cell || typeof cell.score !== 'number' || !Number.isFinite(cell.score))
        throw new Error(`${who} 第 ${i + 1} 格的分數不是數字`);
    });
  }
}

export function load(storage) {
  const text = storage.getItem(KEY);
  if (!text) return { runs: [], warning: null };

  let data;
  try {
    data = JSON.parse(text);
    validate(data);
  } catch (e) {
    storage.setItem(BROKEN_KEY, text);
    return {
      runs: [],
      warning: `存檔讀不出來（${e.message}）。原始資料已備份，沒有被清掉。`
    };
  }

  if (data.v > SCHEMA) {
    return { runs: [], warning: '這份存檔的版本比目前的程式新，請重新整理取得新版後再試。' };
  }
  return { runs: data.runs, warning: null };
}

export function save(storage, runs) {
  try {
    storage.setItem(KEY, JSON.stringify({ v: SCHEMA, runs }));
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: `存不進去（${e.message}）。建議先匯出備份。` };
  }
}

/** 只匯出自己的趟，不轉手散播別人的資料 */
export function exportText(runs) {
  return JSON.stringify(
    { v: SCHEMA, runs: runs.filter(r => r.origin === 'mine') },
    null, 2
  );
}

export function parseImport(text, origin, from) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('資料格式不對，這不是有效的 JSON');
  }
  validate(data);
  if (data.v > SCHEMA) throw new Error('這份資料的版本比目前的程式新，請先更新頁面');

  return data.runs.map(run => {
    const copy = { ...run, origin };
    if (origin === 'imported') copy.from = from || '匿名';
    else delete copy.from;
    return copy;
  });
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 39 通過，0 失敗

- [ ] **Step 5: Commit**

```bash
git add js/store.js tests/
git commit -m "feat: 加入 store，處理持久化、驗證與匯出匯入"
```

---

## Task 5: 頁面骨架與 main.js 調度

到這裡先讓網站「能開、能顯示內建 6 趟的總覽卡」，視圖細節留給後面。這樣每個視圖 Task 都能在真的頁面上驗。

**Files:**
- Create: `index.html`
- Create: `.nojekyll`
- Create: `css/base.css`
- Create: `css/app.css`
- Create: `js/main.js`
- Copy: `vendor/chart.umd.js`

**Interfaces:**
- Consumes: `baseline.js`、`store.js`、`stats.js`
- Produces:
  - `main.js` 的 state 形狀：`{ runs: Run[], visible: Set<string>, mode: 'raw'|'dev'|'cum', tab: 'stats'|'manage', mean: number[20], meanSource: 'mine'|'builtin', warning: string|null }`
  - `actions` 物件：`{ mutate(fn), openEntry(run|null), rerender() }`
  - **各 view 一律實作 `mount(el, actions)` 與 `update(state)` 兩個函式。view 不得 import `main.js`，也不得互相 import** —— 需要別人做事就用 `actions`。相依單向 `main → view-*`，沒有循環

- [ ] **Step 1: 取出 Chart.js**

`lv6-relic-scores.html` 第 130–144 行是內嵌的 Chart.js UMD。把 `<script>` 標籤之間的內容（含第 130 行 `/*!` 開頭的授權註解）原封不動存成 `vendor/chart.umd.js`。不要改動任何一個字元。

- [ ] **Step 2: 取出 CSS**

`lv6-relic-scores.html` 第 3–87 行之間的 `<style>` 內容拆兩份：

- `css/base.css`：`:root` 變數、`@media (prefers-color-scheme: dark)`、`body`、字型與中文排版設定
- `css/app.css`：其餘版面與元件樣式

拆的界線以「換掉 app.css 後 base.css 仍能單獨成立」為準。

- [ ] **Step 3: 建立 index.html**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>遺跡 LV6 · 遺物分數紀錄</title>
<link rel="stylesheet" href="./css/base.css">
<link rel="stylesheet" href="./css/app.css">
</head>
<body>
<div class="wrap">
  <h1>遺跡 LV6 · 遺物分數紀錄</h1>
  <p class="sub">每趟 20 個檢查點（5%–100%）· 資料只存在你自己的瀏覽器</p>

  <div id="warning" class="warning" hidden></div>

  <nav class="tabs" id="tabs">
    <button class="tab" data-tab="stats" aria-pressed="true">統計</button>
    <button class="tab" data-tab="manage" aria-pressed="false">我的紀錄</button>
  </nav>

  <section id="tab-stats">
    <div class="runs" id="runs"></div>
    <div class="modes" id="modes">
      <button class="mode" data-m="raw" aria-pressed="true">單關分數</button>
      <button class="mode" data-m="dev" aria-pressed="false">與平均差距</button>
      <button class="mode" data-m="cum" aria-pressed="false">累積差距</button>
    </div>
    <p class="basis" id="basis"></p>
    <div class="chartwrap"><canvas id="c" role="img"
      aria-label="各趟 LV6 紀錄在 5% 到 100% 檢查點的遺物分數折線圖"></canvas></div>
    <p class="note"><span></span>灰底為正面關（30% / 50% / 70% / 90%），只掉正向遺物，分數天然偏低</p>
    <div id="detail"></div>
    <div id="dist"></div>
  </section>

  <section id="tab-manage" hidden>
    <div id="manage"></div>
    <div id="entry"></div>
  </section>
</div>

<script src="./vendor/chart.umd.js"></script>
<script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: 建立 .nojekyll**

空檔案。GitHub Pages 預設跑 Jekyll，會忽略底線開頭的路徑；這個檔關掉它。

```bash
touch .nojekyll
```

- [ ] **Step 5: 建立 main.js**

```js
import { BASELINE } from './baseline.js';
import * as store from './store.js';
import { meanBasis, meanByCheckpoint } from './stats.js';

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

recompute();
render();
```

- [ ] **Step 6: 在瀏覽器驗證**

```bash
python -m http.server 8000
```

開 `http://localhost:8000`，確認：

1. 頁面載入無 console 錯誤
2. 「統計」「我的紀錄」兩個分頁可切換
3. 基準文字顯示「基準：內建 6 趟 · 你滿 2 趟後改用自己的」
4. 開無痕視窗再開一次，頂部出現「這個瀏覽器不讓存資料」橫幅

`file://` 開不起來是正常的 —— ES module 受 CORS 限制，一定要透過 HTTP 伺服器。

- [ ] **Step 7: Commit**

```bash
git add index.html .nojekyll css/ js/main.js vendor/
git commit -m "feat: 加入頁面骨架、CSS 拆檔與 main.js state 調度"
```

---

## Task 6: view-chart.js —— 折線圖

**Files:**
- Create: `js/view-chart.js`
- Create: `tests/view-chart.test.mjs`
- Modify: `js/main.js`（註冊 view）
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `config.js`、`stats.js`、`decode.js`、全域 `Chart`
- Produces:
  - `buildDatasets(state) => Array<{ label, data, borderColor, borderDash, hidden }>`（純函式，可在 node 測）
  - `mount(el, actions)`、`update(state)`

- [ ] **Step 1: 寫失敗的測試**

`tests/view-chart.test.mjs`：

```js
import { test, ok, eq } from './harness.mjs';
import { BASELINE } from '../js/baseline.js';
import { meanByCheckpoint } from '../js/stats.js';
import { buildDatasets } from '../js/view-chart.js';

const mkState = (over = {}) => ({
  runs: BASELINE,
  visible: new Set(BASELINE.map(r => r.id)),
  mode: 'raw',
  mean: meanByCheckpoint(BASELINE),
  ...over
});

test('每趟一個 dataset', () => {
  eq(buildDatasets(mkState()).length, 6);
});

test('raw 模式吐原始分數', () => {
  const ds = buildDatasets(mkState());
  eq(ds[0].data[0], 342);
  eq(ds[0].label, 'LV6 1st');
});

test('dev 模式吐與平均的差', () => {
  const state = mkState({ mode: 'dev' });
  const ds = buildDatasets(state);
  eq(ds[0].data[0], 342 - state.mean[0]);
});

test('cum 模式是 dev 的前綴和', () => {
  const state = mkState({ mode: 'cum' });
  const ds = buildDatasets(state);
  const dev = buildDatasets(mkState({ mode: 'dev' }))[0].data;
  eq(ds[0].data[19], dev.reduce((a, b) => a + b, 0));
});

test('隱藏的趟標成 hidden 而不是被刪掉', () => {
  const state = mkState({ visible: new Set([BASELINE[0].id]) });
  const ds = buildDatasets(state);
  eq(ds.length, 6, '數量不該變');
  eq(ds[0].hidden, false);
  eq(ds[1].hidden, true);
});

test('顏色循環不會用完', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    ...BASELINE[0], id: `x${i}`, name: `第${i}趟`
  }));
  const ds = buildDatasets(mkState({ runs: many, visible: new Set(many.map(r => r.id)) }));
  eq(ds.length, 20);
  ok(ds.every(d => typeof d.borderColor === 'string' && d.borderColor), '顏色不該是空的');
});
```

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加 `import './view-chart.test.mjs';`

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/view-chart.js'`

- [ ] **Step 3: 實作 view-chart.js**

圖表選項、`bands` / `zero` 兩個 plugin、tooltip 回調，全部從 `lv6-relic-scores.html:218-302` 移植。改動只有兩處：資料改吃 `state`、`Chart` 實例改成模組內變數以便 `update` 時重繪。

```js
import { PROG, STAGE, FRONT } from './config.js';
import { deviation, cumulative } from './stats.js';
import { label } from './decode.js';

const HUE = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7','#e34948'];
const DASH = [[],[6,3],[2,3],[9,3,2,3],[11,4],[4,2],[3,3,8,3],[14,4]];

const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();

/** 純函式，方便在 node 測。不碰 DOM。 */
export function buildDatasets(state) {
  return state.runs.map((run, i) => {
    const data =
      state.mode === 'dev' ? deviation(run, state.mean)
      : state.mode === 'cum' ? cumulative(run, state.mean)
      : run.cells.map(c => c.score);
    return {
      label: run.name,
      data,
      borderColor: HUE[i % HUE.length],
      backgroundColor: HUE[i % HUE.length],
      borderDash: DASH[i % DASH.length],
      hidden: !state.visible.has(run.id),
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      tension: 0.15,
      borderJoinStyle: 'round',
      borderCapStyle: 'round'
    };
  });
}

let chart = null;
let lastState = null;

const bands = { id: 'bands', beforeDatasetsDraw(ch) {
  const x = ch.scales.x, a = ch.chartArea, w = (a.right - a.left) / PROG.length;
  ch.ctx.save();
  ch.ctx.fillStyle = css('--band');
  for (const i of FRONT) ch.ctx.fillRect(x.getPixelForValue(i) - w / 2, a.top, w, a.bottom - a.top);
  ch.ctx.restore();
}};

const zero = { id: 'zero', beforeDatasetsDraw(ch) {
  if (!lastState || lastState.mode === 'raw') return;
  const y = ch.scales.y.getPixelForValue(0), a = ch.chartArea;
  ch.ctx.save();
  ch.ctx.strokeStyle = css('--line2');
  ch.ctx.lineWidth = 1;
  ch.ctx.beginPath();
  ch.ctx.moveTo(a.left, y);
  ch.ctx.lineTo(a.right, y);
  ch.ctx.stroke();
  ch.ctx.restore();
}};

const fmt = v => Math.round(v).toLocaleString('en-US');

export function mount(el, _actions) {   // 折線圖不需要 actions，簽章統一
  chart = new Chart(el, {
    type: 'line',
    plugins: [bands, zero],
    data: { labels: PROG, datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 11,
          boxPadding: 4,
          itemSort: (a, b) => b.parsed.y - a.parsed.y,
          callbacks: {
            title: t => `進度 ${PROG[t[0].dataIndex]} · ${STAGE[t[0].dataIndex]}`,
            label: ctx => {
              const run = lastState.runs[ctx.datasetIndex];
              const cell = run.cells[ctx.dataIndex];
              const name = label(cell.score);
              const target = cell.target ? `${cell.target}·` : '';
              const value = lastState.mode === 'raw'
                ? fmt(ctx.parsed.y)
                : (ctx.parsed.y > 0 ? '+' : '') + fmt(ctx.parsed.y);
              return `${run.name}　${value}${name ? `　${target}${name}` : ''}`;
            }
          }
        }
      }
    }
  });
}

export function update(state) {
  lastState = state;
  chart.data.datasets = buildDatasets(state);
  chart.update();
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 45 通過，0 失敗

- [ ] **Step 5: 在 main.js 註冊**

`main.js` 最上方加 import，`recompute()` 之前加註冊：

```js
import * as viewChart from './view-chart.js';
// ...
register(viewChart, document.getElementById('c'));
```

註冊必須在 `recompute(); render();` 兩行之前。

- [ ] **Step 6: 在瀏覽器驗證**

`python -m http.server 8000` 後確認：

1. 六條折線畫出來，正面關（30/50/70/90%）有灰底
2. 三個模式按鈕都能切，`dev` 與 `cum` 出現零線
3. hover 顯示「LV6 1st　342　敏·死亡寶石」這種格式
4. 切深色模式（作業系統設定），灰底與零線顏色跟著變

- [ ] **Step 7: Commit**

```bash
git add js/view-chart.js js/main.js tests/
git commit -m "feat: 折線圖移植到 view-chart，資料改吃 state"
```

---

## Task 7: view-detail.js —— 每輪明細表

**Files:**
- Create: `js/view-detail.js`
- Create: `tests/view-detail.test.mjs`
- Modify: `js/main.js`
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `config.js`、`stats.js`、`decode.js`
- Produces:
  - `buildRows(run, mean) => Array<{ prog, stage, score, target, relic, effect, dev, warn }>`
  - `mount(el, actions)`、`update(state)`

- [ ] **Step 1: 寫失敗的測試**

`tests/view-detail.test.mjs`：

```js
import { test, ok, eq } from './harness.mjs';
import { CELLS } from '../js/config.js';
import { BASELINE } from '../js/baseline.js';
import { meanByCheckpoint } from '../js/stats.js';
import { buildRows } from '../js/view-detail.js';

const mean = meanByCheckpoint(BASELINE);

test('每趟 20 列', () => {
  eq(buildRows(BASELINE[0], mean).length, CELLS);
});

test('第一列是 5% 單線', () => {
  const row = buildRows(BASELINE[0], mean)[0];
  eq(row.prog, '5%');
  eq(row.stage, '單線');
  eq(row.score, 342);
  eq(row.target, '敏');
  eq(row.relic, '死亡寶石');
});

test('同分遺物列出全部候選', () => {
  const run = { ...BASELINE[0], cells: BASELINE[0].cells.map((c, i) =>
    i === 0 ? { score: 1200, target: '力' } : c) };
  eq(buildRows(run, mean)[0].relic, '感染的樹液／腐爛的尾巴／詛咒的咒文書');
});

test('差距是分數減平均', () => {
  const row = buildRows(BASELINE[0], mean)[0];
  eq(row.dev, 342 - mean[0]);
});

test('最後一列是魔王兔兔，沒有遺物', () => {
  const row = buildRows(BASELINE[0], mean)[19];
  eq(row.stage, '魔王兔兔');
  eq(row.score, 0);
  eq(row.relic, '');
  eq(row.warn, false, '第 20 格分數 0 是正常的，不該標警告');
});

test('查無此分數標 warn', () => {
  const run = { ...BASELINE[0], cells: BASELINE[0].cells.map((c, i) =>
    i === 0 ? { score: 999, target: null } : c) };
  const row = buildRows(run, mean)[0];
  eq(row.warn, true);
  eq(row.relic, '');
});
```

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加 `import './view-detail.test.mjs';`

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/view-detail.js'`

- [ ] **Step 3: 實作 view-detail.js**

```js
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 51 通過，0 失敗

- [ ] **Step 5: 在 main.js 註冊**

```js
import * as viewDetail from './view-detail.js';
// register 那一段加：
register(viewDetail, document.getElementById('detail'));
```

重繪走 `actions.rerender`，不需要額外的事件監聽。

- [ ] **Step 6: 在瀏覽器驗證**

1. 明細表出現，預設選最後一趟
2. 點不同趟的按鈕會換表
3. 備註與小計、總分顯示正確（LV6 4th 應為 135,475）
4. 手機寬度下表格可橫向捲動，頁面本身不橫向捲

- [ ] **Step 7: Commit**

```bash
git add js/view-detail.js js/main.js tests/
git commit -m "feat: 每輪明細表移植到 view-detail"
```

---

## Task 8: view-dist.js —— 分數分布

**Files:**
- Create: `js/view-dist.js`
- Create: `tests/view-dist.test.mjs`
- Modify: `js/main.js`
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `official.js`、`decode.js`
- Produces:
  - `buildPanels(runs) => Array<{ key, ticks: Array<{ score, name, hits, from: string[] }> }>`
  - `mount(el, actions)`、`update(state)`

- [ ] **Step 1: 寫失敗的測試**

`tests/view-dist.test.mjs`：

```js
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
```

342 的出處：1st 5%、2nd 5%、3rd 20%、4th 5%、6th 10%、6th 20% —— 共 6 次。

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加 `import './view-dist.test.mjs';`

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/view-dist.js'`

- [ ] **Step 3: 實作 view-dist.js**

視覺呈現（刻度尺、圓點、hover 卡）從 `lv6-relic-scores.html:303` 之後那段移植，資料來源改成 `buildPanels`。

```js
import { RELICS } from './official.js';
import { PROG } from './config.js';

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
    return `<span class="tick" style="left:${pct}%" title="${title}">${dot}</span>`;
  }).join('');

  return `
    <div class="panel">
      <div class="plabel">${grade} 級 · ${sign}向 · ${kind}</div>
      <div class="axis">${marks}</div>
      <div class="prange"><span>${lo.toLocaleString('en-US')}</span><span>${hi.toLocaleString('en-US')}</span></div>
    </div>`;
}
```

`css/app.css` 需要 `.panel` / `.axis` / `.tick` / `.dot` / `.prange` 的樣式 —— 從原 HTML 的對應樣式移植。

- [ ] **Step 4: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 55 通過，0 失敗

- [ ] **Step 5: 在 main.js 註冊**

```js
import * as viewDist from './view-dist.js';
register(viewDist, document.getElementById('dist'));
```

- [ ] **Step 6: 在瀏覽器驗證**

1. 十二個面板都出現（原本只有九個 —— 正向類型三組現在會是全空的刻度尺，這是對的）
2. hover 刻度顯示分數、遺物名、抽中次數與出處
3. 隱藏某一趟後，命中數跟著減少

- [ ] **Step 7: Commit**

```bash
git add js/view-dist.js css/app.css js/main.js tests/
git commit -m "feat: 分數分布移植到 view-dist，補上正向類型三組"
```

---

## Task 9: view-entry.js —— 輸入與編輯表單

這是最大一塊新功能。

**Files:**
- Create: `js/view-entry.js`
- Create: `tests/view-entry.test.mjs`
- Modify: `css/app.css`
- Modify: `js/main.js`
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `config.js`、`decode.js`、`store.js`、`actions.mutate`
- Produces:
  - `buildFields(run) => Array<{ index, prog, stage, score, target, badge, options, locked, warn }>`
  - `nextRunName(runs) => string`
  - `open(run|null)`、`mount(el, actions)`、`update(state)`

- [ ] **Step 1: 寫失敗的測試**

`tests/view-entry.test.mjs`：

```js
import { test, ok, eq } from './harness.mjs';
import { CELLS } from '../js/config.js';
import { blankRun } from '../js/store.js';
import { BASELINE } from '../js/baseline.js';
import { buildFields, nextRunName } from '../js/view-entry.js';

test('空白趟產生 20 個欄位', () => {
  eq(buildFields(blankRun('新的')).length, CELLS);
});

test('未填分數時沒有徽章也沒有選項', () => {
  const f = buildFields(blankRun('新的'))[0];
  eq(f.badge, '');
  eq(f.options, []);
  eq(f.warn, false, '還沒填不算錯');
});

test('填了類型遺物分數給三個選項', () => {
  const run = blankRun('新的');
  run.cells[0] = { score: 342, target: null };
  const f = buildFields(run)[0];
  eq(f.badge, 'C · 負向 · 類型');
  eq(f.options, ['力', '敏', '智']);
});

test('填了屬性遺物分數給五個選項', () => {
  const run = blankRun('新的');
  run.cells[0] = { score: 317, target: null };
  const f = buildFields(run)[0];
  eq(f.badge, 'C · 負向 · 屬性');
  eq(f.options, ['火', '水', '木', '光', '暗']);
});

test('正面關不預先限制選項', () => {
  const run = blankRun('新的');
  run.cells[9] = { score: 800, target: null };  // 50% 正面B級，正向類型
  const f = buildFields(run)[9];
  eq(f.badge, 'B · 正向 · 類型');
  eq(f.options, ['力', '敏', '智'], '正向類型雖然實測沒出現過，但官方表有，不該擋掉');
});

test('查無此分數標 warn 但不鎖', () => {
  const run = blankRun('新的');
  run.cells[0] = { score: 999, target: null };
  const f = buildFields(run)[0];
  eq(f.warn, true);
  eq(f.locked, false, '警告不該阻擋輸入');
});

test('第 20 格鎖住', () => {
  const f = buildFields(blankRun('新的'))[19];
  eq(f.locked, true);
  eq(f.stage, '魔王兔兔');
  eq(f.options, []);
});

test('趟名依現有紀錄遞增', () => {
  eq(nextRunName([]), 'LV6 1st');
  eq(nextRunName(BASELINE), 'LV6 7th');
});

test('趟名遞增只看自己與內建的數量', () => {
  const runs = [...BASELINE, { ...blankRun('隨便取的'), origin: 'mine' }];
  eq(nextRunName(runs), 'LV6 8th');
});
```

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加 `import './view-entry.test.mjs';`

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/view-entry.js'`

- [ ] **Step 3: 實作 view-entry.js**

```js
import { PROG, STAGE, BOSS_INDEX } from './config.js';
import { decode, targetOptions } from './decode.js';
import { blankRun, DRAFT_KEY } from './store.js';

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
      render();
      const again = root.querySelector(`input[data-i="${i}"]`);
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
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

function render() {
  if (!root) return;
  if (!editing) {
    root.innerHTML = `<button id="entry-new" class="primary">新增一趟</button>`;
    root.querySelector('#entry-new').addEventListener('click', () => {
      open({ ...blankRun(nextRunName(lastState ? lastState.runs : [])) });
    });
    return;
  }

  const rows = buildFields(editing).map(f => `
    <div class="cell ${f.warn ? 'warn' : ''} ${f.locked ? 'locked' : ''}">
      <div class="cellhead"><b>${f.prog}</b><span>${f.stage}</span></div>
      ${f.locked
        ? `<div class="cellnote">魔王關，沒有遺物</div>`
        : `<input type="text" inputmode="numeric" pattern="[0-9]*"
                 data-i="${f.index}" value="${f.score || ''}" placeholder="分數">
           <div class="badge">${f.badge}</div>
           ${f.warn ? `<div class="cellwarn">官方表沒有這個分數，確認一下？</div>` : ''}
           <div class="chips">${f.options.map(o =>
             `<button data-chip="${o}" data-i="${f.index}"
                      aria-pressed="${f.target === o}">${o}</button>`).join('')}</div>`}
    </div>`).join('');

  root.innerHTML = `
    <div class="entry">
      <label>趟次名稱<input id="entry-name" value="${editing.name}"></label>
      <label>備註<input id="entry-note" value="${editing.note}" placeholder="例如：75% 開始坐牢"></label>
      <div class="cells">${rows}</div>
      <div class="entryfoot">
        <button id="entry-save" class="primary">存檔</button>
        <button id="entry-cancel">取消</button>
      </div>
    </div>`;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 64 通過，0 失敗

- [ ] **Step 5: 加樣式**

`css/app.css` 末尾加入。手機一關一張卡，桌機 ≥720px 排成橫的一列：

```css
/* ── 輸入表單 ── */
.entry label { display:block; margin:10px 0 }
.entry label input { display:block; width:100%; margin-top:4px }
.entry input, .entry textarea {
  padding:10px; font:inherit; color:var(--ink);
  background:transparent; border:1px solid var(--line); border-radius:8px;
}
.cells { display:grid; gap:12px; margin:16px 0 }
.cell {
  padding:12px; border:1px solid var(--line); border-radius:10px;
  display:grid; gap:8px;
}
.cell.warn { border-color:#d64545 }
.cell.locked { opacity:.55 }
.cellhead { display:flex; gap:8px; align-items:baseline }
.cellhead b { font-size:15px }
.cellhead span { color:var(--ink3); font-size:13px }
.cell input { width:100%; font-size:17px }  /* ≥16px 才不會讓 iOS 自動放大 */
.badge { color:var(--ink2); font-size:13px; min-height:1.2em }
.cellwarn { color:#d64545; font-size:13px }
.chips { display:flex; flex-wrap:wrap; gap:8px }
.chips button {
  min-width:44px; min-height:44px; padding:0 14px;
  font:inherit; color:var(--ink); cursor:pointer;
  background:transparent; border:1px solid var(--line); border-radius:22px;
}
.chips button[aria-pressed="true"] { background:var(--ink); color:var(--bg); border-color:var(--ink) }
.entryfoot { display:flex; gap:10px; position:sticky; bottom:0; padding:12px 0; background:var(--bg) }
button.primary { background:var(--ink); color:var(--bg); border:0 }
.entryfoot button { min-height:44px; padding:0 20px; border-radius:8px; font:inherit; cursor:pointer }

@media (min-width:720px) {
  .cell { grid-template-columns:120px 110px 150px 1fr; align-items:center; gap:12px }
  .cellhead { flex-direction:column; gap:0 }
  .badge, .chips { margin:0 }
  .cellwarn { grid-column:1 / -1 }
}
```

- [ ] **Step 6: 在 main.js 註冊並補上 openEntry**

```js
import * as viewEntry from './view-entry.js';
// actions 的 openEntry 在 Task 5 是 null，這裡填上：
actions.openEntry = viewEntry.open;
register(viewEntry, document.getElementById('entry'));
```

`view-entry.js` 不 import `main.js` —— 要存檔就呼叫 `act.mutate(...)`。相依維持單向。

- [ ] **Step 7: 在瀏覽器驗證**

1. 「我的紀錄」分頁 → 「新增一趟」，名稱預設 `LV6 7th`
2. 第 1 格打 `342` → 徽章顯示 `C · 負向 · 類型`，chip 出現 力/敏/智
3. 打 `317` → 徽章變 `C · 負向 · 屬性`，chip 變 火/水/木/光/暗
4. 打 `999` → 紅框 +「官方表沒有這個分數」，但仍可繼續
5. 第 20 格顯示「魔王關，沒有遺物」，不可輸入
6. 填到一半重新整理頁面 → 草稿還在
7. 存檔 → 折線圖多一條、明細多一個按鈕
8. 存滿兩趟 → 基準文字變成「基準：你自己的紀錄」
9. 手機寬度下 chip 好按，選完自動捲到下一關

- [ ] **Step 8: Commit**

```bash
git add js/view-entry.js css/app.css js/main.js tests/
git commit -m "feat: 加入輸入表單，分數自動推導級距與正負，chip 補目標"
```

---

## Task 10: view-manage.js —— 趟次清單與匯出匯入

**Files:**
- Create: `js/view-manage.js`
- Create: `tests/view-manage.test.mjs`
- Modify: `css/app.css`
- Modify: `js/main.js`
- Modify: `tests/run.mjs`

**Interfaces:**
- Consumes: `store.js`、`stats.js`、`actions.openEntry`、`actions.mutate`
- Produces:
  - `buildList(runs) => Array<{ id, name, note, total, origin, badge, editable, deletable }>`
  - `mount(el, actions)`、`update(state)`

- [ ] **Step 1: 寫失敗的測試**

`tests/view-manage.test.mjs`：

```js
import { test, ok, eq } from './harness.mjs';
import { BASELINE } from '../js/baseline.js';
import { blankRun } from '../js/store.js';
import { buildList } from '../js/view-manage.js';

const mine = { ...blankRun('我的一趟'), origin: 'mine' };
const friend = { ...blankRun('朋友的'), origin: 'imported', from: '朋友A' };

test('列出全部趟次', () => {
  eq(buildList([...BASELINE, mine, friend]).length, 8);
});

test('內建的不可編輯不可刪', () => {
  const row = buildList(BASELINE)[0];
  eq(row.editable, false);
  eq(row.deletable, false);
  eq(row.badge, '內建');
});

test('自己的可編輯可刪', () => {
  const row = buildList([mine])[0];
  eq(row.editable, true);
  eq(row.deletable, true);
  eq(row.badge, '');
});

test('朋友的可刪不可編輯，徽章帶來源', () => {
  const row = buildList([friend])[0];
  eq(row.editable, false);
  eq(row.deletable, true);
  eq(row.badge, '來自 朋友A');
});

test('總分算進去', () => {
  eq(buildList(BASELINE)[3].total, 135475);
});
```

- [ ] **Step 2: 執行測試確認失敗**

`tests/run.mjs` 加 `import './view-manage.test.mjs';`

Run: `node tests/run.mjs`
Expected: FAIL —— `Cannot find module '../js/view-manage.js'`

- [ ] **Step 3: 實作 view-manage.js**

```js
import { total } from './stats.js';
import { exportText, parseImport } from './store.js';

export function buildList(runs) {
  return runs.map(r => ({
    id: r.id,
    name: r.name,
    note: r.note || '',
    total: total(r),
    origin: r.origin,
    badge: r.origin === 'builtin' ? '內建'
         : r.origin === 'imported' ? `來自 ${r.from || '匿名'}`
         : '',
    editable: r.origin === 'mine',
    deletable: r.origin !== 'builtin'
  }));
}

const fmt = v => v.toLocaleString('en-US');
let root = null;
let act = null;
let lastState = null;

export function mount(el, actions) {
  root = el;
  act = actions;

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
      setTimeout(() => { btn.textContent = '複製到剪貼簿'; }, 2000);
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
      const text = root.querySelector('#im-text').value.trim();
      const whose = root.querySelector('input[name="whose"]:checked').value;
      const from = root.querySelector('#im-from').value.trim();
      try {
        const incoming = parseImport(text, whose, from);
        act.mutate(mine => {
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
        root.querySelector('#im-text').value = '';
        root.querySelector('#im-msg').textContent = `匯入了 ${incoming.length} 趟。`;
      } catch (err) {
        root.querySelector('#im-msg').textContent = `匯入失敗：${err.message}`;
      }
    }
  });
}

export function update(state) {
  lastState = state;
  const rows = buildList(state.runs).map(r => `
    <li>
      <div><b>${r.name}</b>${r.badge ? ` <em>${r.badge}</em>` : ''}
        <span class="num">${fmt(r.total)}</span></div>
      ${r.note ? `<div class="sub">${r.note}</div>` : ''}
      <div class="ops">
        ${r.editable ? `<button data-edit="${r.id}">編輯</button>` : ''}
        ${r.deletable ? `<button data-del="${r.id}" class="danger">刪除</button>` : ''}
      </div>
    </li>`).join('');

  root.innerHTML = `
    <h2>趟次</h2>
    <ul class="runlist">${rows}</ul>

    <h2>備份</h2>
    <p class="sub">只會匯出你自己輸入的趟，不含內建與朋友的。</p>
    <div class="ops">
      <button id="ex-copy">複製到剪貼簿</button>
      <button id="ex-file">下載 .json</button>
    </div>

    <h2>匯入</h2>
    <textarea id="im-text" rows="4" placeholder="把匯出的 JSON 貼在這裡"></textarea>
    <div class="whose">
      <label><input type="radio" name="whose" value="mine" checked>我自己的（計入平均）</label>
      <label><input type="radio" name="whose" value="imported">朋友的（只拿來比較）</label>
      <input id="im-from" placeholder="朋友的名字">
    </div>
    <button id="im-go" class="primary">匯入</button>
    <p id="im-msg" class="sub"></p>`;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `node tests/run.mjs`
Expected: PASS —— 69 通過，0 失敗

- [ ] **Step 5: 加樣式**

`css/app.css` 末尾加入：

```css
/* ── 趟次管理 ── */
.runlist { list-style:none; padding:0; margin:12px 0; display:grid; gap:10px }
.runlist li { padding:12px; border:1px solid var(--line); border-radius:10px }
.runlist li > div:first-child { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap }
.runlist em { font-style:normal; font-size:12px; color:var(--ink3);
              padding:2px 8px; border:1px solid var(--line); border-radius:20px }
.runlist .num { margin-left:auto; font-variant-numeric:tabular-nums }
.ops { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px }
.ops button {
  min-height:44px; padding:0 16px; font:inherit; color:var(--ink); cursor:pointer;
  background:transparent; border:1px solid var(--line); border-radius:8px;
}
.ops button.danger { color:#d64545; border-color:#d64545 }
#im-text { width:100%; padding:10px; font:inherit; color:var(--ink);
           background:transparent; border:1px solid var(--line); border-radius:8px }
.whose { display:grid; gap:8px; margin:10px 0 }
.whose label { display:flex; gap:8px; align-items:center; min-height:44px }
#im-from { padding:10px; font:inherit; color:var(--ink);
           background:transparent; border:1px solid var(--line); border-radius:8px }
#im-go { min-height:44px; padding:0 20px; border-radius:8px; font:inherit; cursor:pointer }
```

- [ ] **Step 6: 在 main.js 註冊**

```js
import * as viewManage from './view-manage.js';
register(viewManage, document.getElementById('manage'));
```

註冊順序要在 `viewEntry` 之前，讓清單顯示在表單上方。

- [ ] **Step 7: 在瀏覽器驗證**

1. 趟次清單列出 6 趟內建（標「內建」，沒有編輯/刪除鈕）
2. 新增一趟後，該趟有編輯與刪除鈕
3. 編輯 → 表單帶入原資料 → 改一格 → 存檔 → 清單總分跟著變
4. 刪除 → 跳確認 → 確定後從圖表與清單消失
5. 「複製到剪貼簿」→ 貼到記事本，JSON 只含自己的趟
6. 清空 localStorage 後把 JSON 貼回「匯入」→ 選「我自己的」→ 資料回來了
7. 同一份 JSON 再匯入一次選「朋友的」+ 名字 → 跳同 id 詢問 → 選取消 → 多出一趟標「來自 XXX」
8. 貼一段亂碼按匯入 → 顯示「匯入失敗：資料格式不對，這不是有效的 JSON」

- [ ] **Step 8: Commit**

```bash
git add js/view-manage.js css/app.css js/main.js tests/
git commit -m "feat: 加入趟次管理與匯出匯入"
```

---

## Task 11: 收尾與部署

**Files:**
- Delete: `lv6-relic-scores.html`
- Modify: `LV6遺物分數分析.md`（第七節「產出工具」）
- Modify: `CLAUDE.md`（現況一節）
- Create: `README.md`

**Interfaces:**
- Consumes: 全部
- Produces: 線上網址

- [ ] **Step 1: 全套測試與瀏覽器回歸**

Run: `node tests/run.mjs`
Expected: PASS —— 69 通過，0 失敗

再跑一次 Task 5–10 的瀏覽器驗證清單，確認沒有互相破壞。

- [ ] **Step 2: 移除舊檔**

新版功能完全覆蓋舊檔後才刪。刪之前確認 `vendor/chart.umd.js`、`js/official.js`、`css/` 都已經把需要的內容搬完。

```bash
git rm lv6-relic-scores.html
```

- [ ] **Step 3: 更新 md 第七節**

把「產出工具」整節改寫：工具已改成靜態網站、資料存本地、新增紀錄改用網頁表單而不是改 `const RUNS`。保留資料來源說明。

- [ ] **Step 4: 寫 README.md**

```markdown
# 遺跡 LV6 · 遺物分數紀錄

LINE Rangers 遺跡 LV6 的遺物分數紀錄工具。輸入每趟 20 個檢查點的分數，
自動推導遺物級距與正負向，畫出走勢、明細與分數分布。

**資料只存在你自己的瀏覽器**，沒有帳號、沒有後端、不會上傳到任何地方。
換裝置請用「備份」把 JSON 匯出再匯入。

## 使用

開網址就能用。手機直接加到主畫面也可以。

## 開發

無建置。改完直接開：

```bash
python -m http.server 8000
```

`file://` 開不起來，ES module 受 CORS 限制，一定要透過 HTTP 伺服器。

測試：

```bash
node tests/run.mjs
```

零依賴，不需要 `npm install`。

## 資料來源

遺物分數表取自 [github.com/mti0224/rangerbook](https://github.com/mti0224/rangerbook)
的 `res/labyrinth_artifact.json` 與 `res/迷宮遺物.json`，已內嵌，不需連網。

計分結構的完整分析見 [LV6遺物分數分析.md](LV6遺物分數分析.md)。
```

- [ ] **Step 5: 更新 CLAUDE.md**

「檔案地圖」一節把 `lv6-relic-scores.html` 換成新結構；「現況」一節改成已完成、已部署。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: 更新說明文件，移除舊版單檔"
```

- [ ] **Step 7: 推上 GitHub 並開 Pages**

```bash
gh repo create lr-maze-statistic --public --source=. --remote=origin --push
```

到 repo 的 Settings → Pages → Source 選 `Deploy from a branch`、Branch 選 `main` / `/ (root)`、Save。

- [ ] **Step 8: 驗證線上版**

等 Pages 部署完成（約 1 分鐘），開 `https://<帳號>.github.io/lr-maze-statistic/` 確認：

1. 頁面正常載入，console 無 404
2. 用手機開同一個網址，輸入一趟並存檔
3. 關掉瀏覽器再開，資料還在

若 JS 或 CSS 404，檢查是不是有路徑漏了 `./` 前綴。
