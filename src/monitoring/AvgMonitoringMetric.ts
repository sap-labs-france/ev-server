import client, { Gauge, LabelValues } from 'prom-client';

class AvgMonitoringMetric {
  protected gaugeMetricAvg: client.Gauge;
  protected metricCount = 0;
  protected metricAvg = 0;

  // Normal signature with defaults
  public constructor(prefix: string, metricname: string, suffix: number, metrichelp: string, labelNames: string[]) {
    this.gaugeMetricAvg = new client.Gauge({
      name: prefix + '_' + metricname + '_avg_' + suffix,
      help: metrichelp,
      labelNames: labelNames,
    });
  }

  public register(registry: client.Registry): void {
    registry.registerMetric(this.gaugeMetricAvg);
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
export { AvgMonitoringMetric };
