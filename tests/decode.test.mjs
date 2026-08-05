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
