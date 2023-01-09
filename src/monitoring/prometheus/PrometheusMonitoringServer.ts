import { Application, NextFunction, Request, Response } from 'express';
import { ServerAction, ServerType } from '../../types/Server';
import client, { Gauge } from 'prom-client';

import Constants from '../../utils/Constants';
import ExpressUtils from '../../server/ExpressUtils';
import Logging from '../../utils/Logging';
import MonitoringConfiguration from '../../types/configuration/MonitoringConfiguration';
import { ComposedMonitoringMetric } from '../ComposedMonitoringMetric';
import MonitoringServer from '../MonitoringServer';
import { ServerUtils } from '../../server/ServerUtils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'PrometheusMonitoringServer';

export default class PrometheusMonitoringServer extends MonitoringServer {
  private monitoringConfig: MonitoringConfiguration;
  private expressApplication: Application;
  private mapGauge = new Map<string, Gauge>();
  private mapComposedMetric = new Map<string, ComposedMonitoringMetric>();
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
      this.createGaugeMetric(Constants.WEB_SOCKET_OCPP_CONNECTIONS_COUNT, 'The number of ocpp web sockets');
      this.createGaugeMetric(Constants.WEB_SOCKET_REST_CONNECTIONS_COUNT, 'The number of rest web sockets');
      this.createGaugeMetric(Constants.WEB_SOCKET_QUEUED_REQUEST, 'The number of web sockets that are queued');
      this.createGaugeMetric(Constants.WEB_SOCKET_RUNNING_REQUEST, 'The number of web sockets that are running');
      this.createGaugeMetric(Constants.WEB_SOCKET_RUNNING_REQUEST_RESPONSE, 'The number of web sockets request + response that are running');
      this.createGaugeMetric(Constants.WEB_SOCKET_CURRRENT_REQUEST, 'JSON WS Requests in cache');
      this.createGaugeMetric(Constants.MONGODB_CONNECTION_READY, 'The number of connection that are ready');
      this.createGaugeMetric(Constants.MONGODB_CONNECTION_CREATED, 'The number of connection created');
      this.createGaugeMetric(Constants.MONGODB_CONNECTION_CLOSED, 'The number of connection closed');
    }
    // Create HTTP Server
    this.expressApplication = ExpressUtils.initApplication();
    // Handle requests
    this.expressApplication.use(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      '/metrics', async (req: Request, res: Response, next: NextFunction) => {
        // Trace Request
        await Logging.traceExpressRequest(req, res, next, ServerAction.MONITORING);
        // Process
        res.setHeader('Content-Type', this.clientRegistry.contentType);
        res.end(await this.clientRegistry.metrics());
        for (const val of this.mapComposedMetric.values()) {
          val.clear();
        }
        next();
        // Trace Response
        Logging.traceExpressResponse(req, res, next, ServerAction.MONITORING);
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

  public getComposedMetric(prefix : string, metricname: string, suffix: number, metrichelp: string, labelNames: string[]) : ComposedMonitoringMetric {
    const key = prefix + '_' + metricname + '_' + suffix;
    let composedMetric : ComposedMonitoringMetric = this.mapComposedMetric.get(key);
    if (composedMetric) {
      return composedMetric;
    }
    composedMetric = new ComposedMonitoringMetric(prefix, metricname,suffix,metrichelp,labelNames);
    composedMetric.register(this.clientRegistry);
    this.mapComposedMetric.set(key, composedMetric);
    return composedMetric;
  }

  private createGaugeMetric(metricname : string, metrichelp : string, labelNames? : string[]) : Gauge {
    let gaugeMetric : client.Gauge;
    if (Array.isArray(labelNames)) {
      gaugeMetric = new client.Gauge({
        name: metricname,
        help: metrichelp,
        labelNames: labelNames
      });
    } else {
      gaugeMetric = new client.Gauge({
        name: metricname,
        help: metrichelp
      });
    }
    this.mapGauge.set(metricname, gaugeMetric);
    this.clientRegistry.registerMetric(gaugeMetric);
    return gaugeMetric;
  }
}
