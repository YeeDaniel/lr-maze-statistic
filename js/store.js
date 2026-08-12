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
    // id / name / note 會被塞進畫面（見 view-detail.js），匯入的 JSON 不可信，
    // 型別檢查是防止非字串（物件、含跳脫字元的怪東西）混進去的第二道防線。
    if (typeof run.id !== 'string') throw new Error(`${who} 的 id 不是字串`);
    if (typeof run.name !== 'string') throw new Error(`${who} 的 name 不是字串`);
    if (run.note !== undefined && typeof run.note !== 'string')
      throw new Error(`${who} 的 note 不是字串`);
    if (!Array.isArray(run.cells) || run.cells.length !== CELLS)
      throw new Error(`${who} 應該有 ${CELLS} 格，實得 ${run.cells ? run.cells.length : 0} 格`);
    run.cells.forEach((cell, i) => {
      if (!cell || typeof cell.score !== 'number' || !Number.isFinite(cell.score))
        throw new Error(`${who} 第 ${i + 1} 格的分數不是數字`);
    });
  }
}

/** 舊版把別人的紀錄標成 imported 並記 from，現在只剩 builtin 與 mine */
function stripImported(run) {
  if (run.origin !== 'imported') return run;
  const { from, ...rest } = run;
  return { ...rest, origin: 'mine' };
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
  // origin: 'imported'（舊版的「朋友的紀錄」）已經廢掉，讀到就當成自己的
  return { runs: data.runs.map(stripImported), warning: null };
}

export function save(storage, runs) {
  try {
    storage.setItem(KEY, JSON.stringify({ v: SCHEMA, runs }));
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: `存不進去（${e.message}）。先到最下面的「進階：備份與還原」複製一份備份留著。` };
  }
}

/** 備份只含自己輸入的趟，內建基準線是程式碼的一部分，不必存 */
export function exportText(runs) {
  return JSON.stringify(
    { v: SCHEMA, runs: runs.filter(r => r.origin === 'mine') },
    null, 2
  );
}

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
