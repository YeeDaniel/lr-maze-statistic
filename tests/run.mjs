import { report } from './harness.mjs';
import './esc.test.mjs';
import './official.test.mjs';
import './decode.test.mjs';
import './stats.test.mjs';
import './store.test.mjs';
import './view-chart.test.mjs';
import './view-detail.test.mjs';

process.exit(report() ? 1 : 0);
