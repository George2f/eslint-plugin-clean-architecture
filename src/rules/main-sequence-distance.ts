import { metricRule } from '../utils/metric-rule.js';

export default metricRule('main-sequence-distance', 'Distance from the Main Sequence', 0.5,
  (metric, threshold) => metric.distance > threshold);
