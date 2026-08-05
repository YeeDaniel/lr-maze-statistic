import { PROG, STAGE, FRONT } from './config.js';
import { deviation, cumulative, meanBasis } from './stats.js';
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
  const x = ch.scales.x;
  if (!x) return; // mount() 初次繪製時 datasets 還是空的，Chart.js 不會建 x 軸 scale
  const a = ch.chartArea, w = (a.right - a.left) / PROG.length;
  ch.ctx.save();
  ch.ctx.fillStyle = css('--band');
  for (const i of FRONT) ch.ctx.fillRect(x.getPixelForValue(i) - w / 2, a.top, w, a.bottom - a.top);
  ch.ctx.restore();
}};

const zero = { id: 'zero', beforeDatasetsDraw(ch) {
  if (!lastState || lastState.mode === 'raw') return; // raw 模式本來就不畫零線，這是功能邏輯
  const yScale = ch.scales.y;
  if (!yScale) return; // 跟 bands 同一種防呆：datasets 是空的時候 Chart.js 不會建 y 軸 scale
  const y = yScale.getPixelForValue(0), a = ch.chartArea;
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
const signed = v => (v > 0 ? '+' : '') + fmt(v);

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
              const value = lastState.mode === 'raw' ? fmt(ctx.parsed.y) : signed(ctx.parsed.y);
              return `${run.name}　${value}${name ? `　${target}${name}` : ''}`;
            },
            // raw 模式才顯示「N 趟平均」；N 與平均值都要跟 state.mean 用同一個基準，
            // 不能自己重算（自己滿 2 趟用自己的，否則退回內建 6 趟，邏輯在 meanBasis）
            afterBody: t => {
              if (lastState.mode !== 'raw') return '';
              const n = meanBasis(lastState.runs).runs.length;
              return `\n${n} 趟平均 ${fmt(lastState.mean[t[0].dataIndex])}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: css('--line2') },
          ticks: { color: css('--ink3'), font: { size: 11 }, autoSkip: false, maxRotation: 45 }
        },
        y: {
          grid: { color: css('--line') },
          border: { display: false },
          ticks: {
            color: css('--ink3'), font: { size: 11 },
            callback: v => (lastState && lastState.mode !== 'raw') ? signed(v) : fmt(v)
          }
        }
      }
    }
  });

  // 系統深色模式即時切換時，chart.js 不會自己重讀 CSS 變數，要手動把顏色寫回 options 再 update
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chart.options.scales.x.border.color = css('--line2');
    chart.options.scales.x.ticks.color = css('--ink3');
    chart.options.scales.y.grid.color = css('--line');
    chart.options.scales.y.ticks.color = css('--ink3');
    chart.update();
  });
}

export function update(state) {
  lastState = state;
  chart.data.datasets = buildDatasets(state);
  chart.update();
}
