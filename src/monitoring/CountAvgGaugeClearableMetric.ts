import client, { LabelValues } from 'prom-client';

import { AvgGaugeClearableMetric } from './AvgGaugeClearableMetric';

class CountAvgGaugeClearableMetric extends AvgGaugeClearableMetric {
  private gaugeMetricCount: client.Gauge;
  private keyCount: string;

  public constructor(registry : client.Registry, keyAvg: string, keyCount: string, metricAvgHelp: string, metricCountHelp: string, labelNames: string[]) {
    super(registry, keyAvg, metricAvgHelp, labelNames);
    this.gaugeMetricCount = new client.Gauge({
      name: keyCount,
      help: metricCountHelp,
      labelNames: labelNames,
    });
    this.keyCount = keyCount;
    this.register();
  }

  public unregister(): void {
    super.unregister();
    this.registry.removeSingleMetric(this.keyCount);
  }

  public register():void {
    this.registry.registerMetric(this.gaugeMetricCount);
  }

  public setValue(labels: LabelValues<string>, value: number) {
    super.setValue(labels, value);
    this.gaugeMetricCount.labels(labels).set(this.metricCount);
  }

  public clear() {
    super.clear();
    this.gaugeMetricCount.reset();
  }
}
export { CountAvgGaugeClearableMetric };
