import client, { LabelValues } from 'prom-client';

import { Clearable } from './Clearable';

class AvgGaugeClearableMetric extends Clearable {
  protected gaugeMetricAvg: client.Gauge;
  protected metricCount = 0;
  protected metricAvg = 0;
  protected registry :client.Registry;
  private key : string;

  public constructor(registry : client.Registry, key :string, metricHelp: string, labelNames: string[]) {
    super();
    this.gaugeMetricAvg = new client.Gauge({
      name: key,
      help: metricHelp,
      labelNames: labelNames,
    });
    this.registry = registry;
    registry.registerMetric(this.gaugeMetricAvg);
    this.key = key;
  }

  public unregister(): void {
    this.registry.removeSingleMetric(this.key);
  }

  public setValue(labels: LabelValues<string>, value: number) {
    if (this.metricCount === 0) {
      this.metricAvg = 0;
    }
    this.metricAvg = (this.metricAvg * this.metricCount + value) / (this.metricCount + 1);
    this.metricCount++;
    this.gaugeMetricAvg.labels(labels).set(this.metricAvg);
  }

  public clear() {
    this.metricAvg = 0;
    this.metricCount = 0;
    this.gaugeMetricAvg.reset();
  }
}
export { AvgGaugeClearableMetric };
