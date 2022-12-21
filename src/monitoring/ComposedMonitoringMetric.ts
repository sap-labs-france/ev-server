import client, { Gauge, LabelValues } from 'prom-client';

class ComposedMonitoringMetric {
  private gaugeMetricAvg: client.Gauge;
  private gaugeMetricCount: client.Gauge;
  private metricCount = 0;
  private metricAvg = 0;

  // Normal signature with defaults
  public constructor(prefix: string, metricname: string, suffix: number, metrichelp: string, labelNames: string[]) {
    this.gaugeMetricAvg = new client.Gauge({
      name: prefix + '_' + metricname + '_avg_' + suffix,
      help: metrichelp,
      labelNames: labelNames,
    });
    this.gaugeMetricCount = new client.Gauge({
      name: prefix + '_' + metricname + '_count_' + suffix,
      help: metrichelp,
      labelNames: labelNames,
    });
  }

  public register(registry: client.Registry): void {
    registry.registerMetric(this.gaugeMetricAvg);
    registry.registerMetric(this.gaugeMetricCount);
  }

  public setValue(labels: LabelValues<string>, value: number) {
    if (this.metricCount === 0) {
      this.metricAvg = 0;
    }
    this.metricAvg = (this.metricAvg * this.metricCount + value) / (this.metricCount + 1);
    this.metricCount++;
    this.gaugeMetricCount.labels(labels).set(this.metricCount);
    this.gaugeMetricAvg.labels(labels).set(this.metricAvg);
  }

  public clear() {
    this.metricAvg = 0;
    this.metricCount = 0;
    this.gaugeMetricCount.reset();
    this.gaugeMetricAvg.reset();
  }
}
export { ComposedMonitoringMetric };
