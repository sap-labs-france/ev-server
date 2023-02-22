import client, { Gauge, LabelValues } from 'prom-client';

import { AvgGaugeClearableMetric } from './AvgGaugeClearableMetric';
import { Clearable } from './Clearable';

class CounterClearableMetric extends Clearable {
  private registry : client.Registry;
  private counterMetricCount: client.Counter;
  private labelValues : LabelValues<string>;
  private key : string;

  public constructor(registry : client.Registry, key: string, metricHelp: string, labelValues: LabelValues<string>) {
    super();
    this.registry = registry;
    this.key = key;
    const labelNames = Object.keys(labelValues);
    this.counterMetricCount = new client.Counter({
      name: key,
      help: metricHelp,
      labelNames: labelNames,
    });
    this.labelValues = labelValues;
  }

  public register(): void {
    this.registry.registerMetric(this.counterMetricCount);
  }

  public unregister(): void {
    this.registry.removeSingleMetric(this.key);
  }

  public inc() {
    this.counterMetricCount.labels(this.labelValues).inc(1);
  }

  public clear() {
    this.counterMetricCount.reset();
  }
}
export { CounterClearableMetric };
