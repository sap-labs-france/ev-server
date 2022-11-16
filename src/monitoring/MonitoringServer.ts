import client, { Metric } from 'prom-client';

export default abstract class MonitoringServer {
  public abstract start(): void;
  public abstract getGauge(name: string): client.Gauge | undefined;
  public abstract getCounter(name: string): client.Counter | undefined;
}

