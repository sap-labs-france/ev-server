import client, { Gauge, LabelValues } from 'prom-client';
import { AvgMonitoringMetric } from './AvgMonitoringMetric';

class ComposedMonitoringMetric extends AvgMonitoringMetric {
  private gaugeMetricCount: client.Gauge;

  // Normal signature with defaults
  public constructor(prefix: string, metricname: string, suffix: number, metrichelp: string, labelNames: string[]) {
    super(prefix, metricname, suffix, metrichelp, labelNames);
    this.gaugeMetricCount = new client.Gauge({
      name: prefix + '_' + metricname + '_count_' + suffix,
      help: metrichelp,
      labelNames: labelNames,
    });
  }

  public register(registry: client.Registry): void {
    super.register(registry);
    registry.registerMetric(this.gaugeMetricCount);
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
export { ComposedMonitoringMetric };
