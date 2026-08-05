import { report } from './harness.mjs';
import './official.test.mjs';
import './decode.test.mjs';

process.exit(report() ? 1 : 0);
