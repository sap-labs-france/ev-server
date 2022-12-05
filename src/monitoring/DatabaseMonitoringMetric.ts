import client, { Gauge, LabelValues } from 'prom-client';

class DatabaseMonitoringMetric {
  private gaugeMetricAvg: client.Gauge;
  private gaugeMetricCount: client.Gauge;
  private gaugeMetricSum: client.Gauge;
  private metricCount = 0;
  private metricSum = 0;
  private metricAvg = 0;

  // Normal signature with defaults
  public constructor(metricname: string, suffix: number, metrichelp: string, labelNames: string[]) {
    this.gaugeMetricAvg = new client.Gauge({
      name: 'mongod_' + metricname + '_avg_' + suffix,
      help: metrichelp,
      labelNames: labelNames,
    });
    this.gaugeMetricCount = new client.Gauge({
      name: 'mongod_' + metricname + '_count_' + suffix,
      help: metrichelp,
      labelNames: labelNames,
    });
    this.gaugeMetricSum = new client.Gauge({
      name: 'mongod_' + metricname + '_sum_' + suffix,
      help: metrichelp,
      labelNames: labelNames,
    });
  }

  public register(registry: client.Registry): void {
    registry.registerMetric(this.gaugeMetricAvg);
    registry.registerMetric(this.gaugeMetricCount);
    registry.registerMetric(this.gaugeMetricSum);
  }

  public setValue(labels: LabelValues<string>, value: number) {
    if (this.metricCount === 0) {
      this.metricAvg = 0;
    }
    this.metricSum += value;
    this.metricAvg = (this.metricAvg * this.metricCount + value) / (this.metricCount + 1);
    this.metricCount++;
    this.gaugeMetricCount.labels(labels).set(this.metricCount);
    this.gaugeMetricSum.labels(labels).set(this.metricSum);
    this.gaugeMetricAvg.labels(labels).set(this.metricAvg);
  }

  public clear() {
    this.metricSum = 0;
    this.metricAvg = 0;
    this.metricCount = 0;
  }
}
export { DatabaseMonitoringMetric };
