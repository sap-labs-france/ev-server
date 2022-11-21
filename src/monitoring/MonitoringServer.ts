import client from 'prom-client';

export default abstract class MonitoringServer {
  public abstract start(): void;
  public abstract getGauge(name: string): client.Gauge | undefined;
  public abstract createGaugeMetric(metricname : string, metrichelp : string) : client.Gauge;
}

