import { report } from './harness.mjs';
import './official.test.mjs';

process.exit(report() ? 1 : 0);
