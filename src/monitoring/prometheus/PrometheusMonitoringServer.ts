/* eslint-disable max-len */
import { Application, NextFunction, Request, Response } from 'express';
import { ServerAction, ServerType } from '../../types/Server';
import client, { Gauge, LabelValues } from 'prom-client';

import { AvgGaugeClearableMetric } from '../AvgGaugeClearableMetric';
import Constants from '../../utils/Constants';
import { CountAvgGaugeClearableMetric } from '../CountAvgGaugeClearableMetric';
import { CounterClearableMetric } from '../CounterClearableMetric';
import ExpressUtils from '../../server/ExpressUtils';
import Logging from '../../utils/Logging';
import MonitoringConfiguration from '../../types/configuration/MonitoringConfiguration';
import MonitoringServer from '../MonitoringServer';
import { ServerUtils } from '../../server/ServerUtils';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'PrometheusMonitoringServer';

export default class PrometheusMonitoringServer extends MonitoringServer {
  private monitoringConfig: MonitoringConfiguration;
  private expressApplication: Application;
  private mapGauge = new Map<string, Gauge>();
  private mapCounterClearableMetric = new Map<string, CounterClearableMetric>();
  private mapAvgGaugeClearableMetric = new Map<string, AvgGaugeClearableMetric>();
  private clientRegistry = new client.Registry();

  public constructor(monitoringConfig: MonitoringConfiguration) {
    super();
    // Keep params
    this.monitoringConfig = monitoringConfig;
    client.collectDefaultMetrics({ register: this.clientRegistry });
    // Add a default label which is added to all metrics
    this.clientRegistry.setDefaultLabels({
      app: 'e-Mobility'
    });
    if (process.env.K8S) {
      this.createGaugeMetric(Constants.WEB_SOCKET_QUEUED_REQUEST, 'The number of web sockets that are queued');
      this.createGaugeMetric(Constants.WEB_SOCKET_RUNNING_REQUEST, 'The number of web sockets that are running');
      this.createGaugeMetric(Constants.WEB_SOCKET_RUNNING_REQUEST_RESPONSE, 'The number of web sockets request + response that are running');
      this.createGaugeMetric(Constants.WEB_SOCKET_CURRENT_REQUEST, 'JSON WS Requests in cache');
      this.createGaugeMetric(Constants.WEB_SOCKET_OCPP_CONNECTIONS_COUNT, 'number of json web sockets');
      this.createGaugeMetric(Constants.MONGODB_CONNECTION_READY, 'The number of connection that are ready');
      this.createGaugeMetric(Constants.MONGODB_CONNECTION_CREATED, 'The number of connection created');
      this.createGaugeMetric(Constants.MONGODB_CONNECTION_CLOSED, 'The number of connection closed');
    }
    // Create HTTP Server
    this.expressApplication = ExpressUtils.initApplication();
    // Handle requests
    this.expressApplication.use(
      '/metrics', (req: Request, res: Response, next: NextFunction) => {
        // Trace Request
        Logging.traceExpressRequest(req, res, next, ServerAction.MONITORING).then(() => {
          // Process
          res.setHeader('Content-Type', this.clientRegistry.contentType);
          this.clientRegistry.metrics().then((s) => {
            res.end(s);
            for (const val of this.mapAvgGaugeClearableMetric.values()) {
              val.clear();
            }
            for (const val of this.mapCounterClearableMetric.values()) {
              val.clear();
            }
            next();
            // Trace Response
            Logging.traceExpressResponse(req, res, next, ServerAction.MONITORING);

          }).catch((error) => { /* */ });
        }).catch((error) => { /* */ });
      }
    );
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
  }

  public getGauge(name: string): client.Gauge | undefined {
    return this.mapGauge.get(name) ;
  }

  public start(): void {
    global.monitoringServer = this;
    ServerUtils.startHttpServer(this.monitoringConfig,
      ServerUtils.createHttpServer(this.monitoringConfig, this.expressApplication), MODULE_NAME, ServerType.MONITORING_SERVER);
  }

  public getAvgClearableMetric(prefix: string, metricName: string, suffix: number, metricHelp: string, labelNames: string[]) : AvgGaugeClearableMetric {
    const keyAvg = this.getKeyAvg(prefix, metricName, suffix);
    let metric : AvgGaugeClearableMetric = this.mapAvgGaugeClearableMetric.get(keyAvg);
    if (metric) {
      return metric;
    }
    metric = new AvgGaugeClearableMetric(this.clientRegistry, keyAvg, metricHelp, labelNames);
    this.mapAvgGaugeClearableMetric.set(keyAvg, metric);
    return metric;
  }

  public getCountAvgClearableMetric(prefix : string, metricName: string, suffix: number, metricAvgHelp: string, metricCountHelp: string, labelNames: string[]) : CountAvgGaugeClearableMetric {
    const keyAvg = this.getKeyAvg(prefix, metricName, suffix);
    const keyCount = this.getKeyCount(prefix, metricName, suffix);
    let metric : CountAvgGaugeClearableMetric = this.mapAvgGaugeClearableMetric.get(keyCount) as CountAvgGaugeClearableMetric;
    if (metric) {
      return metric;
    }
    metric = new CountAvgGaugeClearableMetric(this.clientRegistry,keyAvg, keyCount,metricAvgHelp , metricCountHelp,labelNames);
    this.mapAvgGaugeClearableMetric.set(keyCount, metric);
    return metric;
  }

  public getCounterClearableMetric(prefix : string, metricName: string, metricHelp: string, labelValues: LabelValues<string>) : CounterClearableMetric {
    // const labelNames = Object.keys(labelValues);
    const values = Object.values(labelValues).toString();
    const metricSuffix = Utils.positiveHashCode(values);
    const key = prefix + '_' + metricName + '_' + metricSuffix;
    let metric : CounterClearableMetric = this.mapCounterClearableMetric.get(key) ;
    if (metric) {
      return metric;
    }
    metric = new CounterClearableMetric(this.clientRegistry,key,metricHelp, labelValues);
    this.mapCounterClearableMetric.set(key, metric);
    metric.register();
    return metric;
  }

  private createGaugeMetric(metricName : string, metricHelp : string, labelNames? : string[]) : Gauge {
    let gaugeMetric : client.Gauge;
    if (Array.isArray(labelNames)) {
      gaugeMetric = new client.Gauge({
        name: metricName,
        help: metricHelp,
        labelNames: labelNames
      });
    } else {
      gaugeMetric = new client.Gauge({
        name: metricName,
        help: metricHelp
      });
    }
    this.mapGauge.set(metricName, gaugeMetric);
    this.clientRegistry.registerMetric(gaugeMetric);
    return gaugeMetric;
  }

  private getKeyAvg(prefix : string, metricName: string, suffix): string {
    return prefix + '_' + metricName + '_avg_' + suffix;
  }

  private getKeyCount(prefix : string, metricName: string, suffix): string {
    return prefix + '_' + metricName + '_count_' + suffix;
  }
}

