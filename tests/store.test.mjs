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

test('validate 擋掉 id 不是字串的趟', () => {
  const r = blankRun('Z');
  r.id = 12345;
  let threw = null;
  try { validate({ v: SCHEMA, runs: [r] }); } catch (e) { threw = e.message; }
  ok(threw, '應該要 throw');
  ok(threw.includes('id'), `訊息應提到 id，實得：${threw}`);
});

test('validate 擋掉 name 不是字串的趟（避免匯入資料把物件塞進 innerHTML）', () => {
  const r = blankRun('W');
  r.name = { evil: '<img src=x onerror=alert(1)>' };
  let threw = null;
  try { validate({ v: SCHEMA, runs: [r] }); } catch (e) { threw = e.message; }
  ok(threw, '應該要 throw');
  ok(threw.includes('name'), `訊息應提到 name，實得：${threw}`);
});

test('validate 擋掉 note 不是字串（且不是 undefined）的趟', () => {
  const r = blankRun('V');
  r.note = 42;
  let threw = null;
  try { validate({ v: SCHEMA, runs: [r] }); } catch (e) { threw = e.message; }
  ok(threw, '應該要 throw');
  ok(threw.includes('note'), `訊息應提到 note，實得：${threw}`);
});

test('validate 允許 note 是 undefined', () => {
  const r = blankRun('U');
  delete r.note;
  validate({ v: SCHEMA, runs: [r] }); // 不該 throw
  ok(true, '不該執行到這裡都算通過');
});

test('storage 寫入失敗時 save 回報而不炸掉', () => {
  const s = memoryStorage();
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  const res = save(s, [mkRun('A')]);
  eq(res.ok, false);
  ok(res.error, '應該要有錯誤訊息');
});
