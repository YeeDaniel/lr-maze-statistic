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
