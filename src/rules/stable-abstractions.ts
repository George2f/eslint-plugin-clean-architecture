import { metricRule } from '../utils/metric-rule.js';

export default metricRule('stable-abstractions', 'Stable Abstractions', 0.5,
  (metric, threshold) => metric.instability < 0.5 && 1 - metric.instability - metric.abstractness > threshold);
