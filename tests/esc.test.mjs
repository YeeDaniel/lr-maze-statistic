import { test, ok, eq } from './harness.mjs';
import { esc } from '../js/esc.js';

test('esc 跳脫 HTML 特殊字元', () => {
  eq(esc(`<img src=x onerror="alert(1)">'&'`),
     '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;&#39;');
});

test('esc 對 null/undefined 回傳空字串', () => {
  eq(esc(null), '');
  eq(esc(undefined), '');
});

test('esc 對一般文字原樣輸出', () => {
  eq(esc('LV6 4th'), 'LV6 4th');
});
