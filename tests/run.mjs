import { report } from './harness.mjs';
import './esc.test.mjs';
import './official.test.mjs';
import './decode.test.mjs';
import './stats.test.mjs';
import './store.test.mjs';
import './view-chart.test.mjs';
import './view-detail.test.mjs';
import './view-dist.test.mjs';
import './view-entry.test.mjs';
import './view-manage.test.mjs';

process.exit(report() ? 1 : 0);
