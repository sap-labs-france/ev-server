
import client from 'prom-client';
import { ComposedMonitoringMetric } from './ComposedMonitoringMetric';

export default abstract class MonitoringServer {
  public abstract start(): void;

  public abstract getGauge(name: string): client.Gauge | undefined;

  public abstract getComposedMetric(
    prefix: string,
    metricname: string,
    suffix: number,
    metrichelp: string,
    labelNames: string[]
  ): ComposedMonitoringMetric;
}
