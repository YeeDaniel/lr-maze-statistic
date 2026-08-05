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
  const x = ch.scales.x;
  if (!x) return; // mount() 初次繪製時 datasets 還是空的，Chart.js 不會建 x 軸 scale
  const a = ch.chartArea, w = (a.right - a.left) / PROG.length;
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
