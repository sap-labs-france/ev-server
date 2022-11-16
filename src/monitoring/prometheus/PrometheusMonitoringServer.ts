import { Application, NextFunction, Request, Response } from 'express';
import { ServerAction, ServerType } from '../../types/Server';

import ExpressUtils from '../../server/ExpressUtils';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MonitoringConfiguration from '../../types/configuration/MonitoringConfiguration';
import MonitoringServer from '../MonitoringServer';
import { ServerUtils } from '../../server/ServerUtils';
import client, { Counter, DefaultMetricsCollectorConfiguration, Gauge, Metric } from 'prom-client';
const MODULE_NAME = 'PrometheusMonitoringServer';
import global from '../../types/GlobalType';

export default class PrometheusMonitoringServer extends MonitoringServer {
  private monitoringConfig: MonitoringConfiguration;
  private expressApplication: Application;
  private mapGauge = new Map<string, Gauge>();
  private mapCounter = new Map<string, Counter>();

  public constructor(monitoringConfig: MonitoringConfiguration) {
    super();
    const webSocketGaugeRest : client.Gauge = new client.Gauge({
      name: Constants.WEB_SOCKET_REST_OPEN_COUNT,
      help: 'The number of rest web sockets that are open'
    });

    const webSocketGaugeOcpp : client.Gauge = new client.Gauge({
      name: Constants.WEB_SOCKET_OCPP16_OPEN_COUNT,
      help: 'The number of ocpp web sockets that are open'
    });
    // Keep params
    this.monitoringConfig = monitoringConfig;
    // Create a Registry which registers the metrics
    const register = new client.Registry();
    // Add a default label which is added to all metrics
    register.setDefaultLabels({
      app: 'e-Mobility'
    });
    client.collectDefaultMetrics({
      register ,
    });
    const mongoDbConnectionCreated : client.Counter = new client.Counter({
      name: Constants.MONGODB_CONNECTION_CREATED,
      help: 'mongo db connection created'
    });
    register.registerMetric(mongoDbConnectionCreated);
    this.mapCounter.set(Constants.MONGODB_CONNECTION_CREATED, mongoDbConnectionCreated);
    const mongoDbConnectionPoolCreated : client.Counter = new client.Counter({
      name: Constants.MONGODB_CONNECTION_POOL_CREATED,
      help: 'mongo db connection pool created'
    });
    register.registerMetric(mongoDbConnectionPoolCreated);
    this.mapCounter.set(Constants.MONGODB_CONNECTION_POOL_CREATED, mongoDbConnectionPoolCreated);
    const mongoDbConnectionClosed : client.Counter = new client.Counter({
      name: Constants.MONGODB_CONNECTION_CLOSED,
      help: 'mongo db connection closed'
    });
    register.registerMetric(mongoDbConnectionClosed);
    this.mapCounter.set(Constants.MONGODB_CONNECTION_CLOSED, mongoDbConnectionClosed);
    const mongoDbConnectionPoolClosed : client.Counter = new client.Counter({
      name: Constants.MONGODB_CONNECTION_POOL_CLOSED,
      help: 'mongo db connection pool closed'
    });
    this.mapCounter.set(Constants.MONGODB_CONNECTION_POOL_CLOSED, mongoDbConnectionPoolClosed);
    register.registerMetric(mongoDbConnectionPoolClosed);
    const mongoDbConnectionReady : client.Gauge = new client.Gauge({
      name: Constants.MONGODB_CONNECTION_READY,
      help: 'mongo db connection ready'
    });
    this.mapGauge.set(Constants.MONGODB_CONNECTION_READY, mongoDbConnectionReady);
    register.registerMetric(mongoDbConnectionReady);
    // Enable the collection of default metrics
    register.registerMetric(webSocketGaugeOcpp);
    register.registerMetric(webSocketGaugeRest);
    this.mapGauge.set(Constants.WEB_SOCKET_OCPP16_OPEN_COUNT, webSocketGaugeOcpp);
    this.mapGauge.set(Constants.WEB_SOCKET_REST_OPEN_COUNT, webSocketGaugeRest);
    // Create HTTP Server
    this.expressApplication = ExpressUtils.initApplication();
    // Handle requests
    this.expressApplication.use(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      '/metrics', async (req: Request, res: Response, next: NextFunction) => {
        // Trace Request
        await Logging.traceExpressRequest(req, res, next, ServerAction.MONITORING);
        // Process
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
        next();
        // Trace Response
        Logging.traceExpressResponse(req, res, next, ServerAction.MONITORING);
      }
    );
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
  }

  public	getGauge(name: string): client.Gauge | undefined {
    return this.mapGauge.get(name) ;
  }

  public	getCounter(name: string): client.Counter | undefined {
    return this.mapCounter.get(name) ;
  }

  public start(): void {
    global.monitoringServer = this;
    ServerUtils.startHttpServer(this.monitoringConfig,
      ServerUtils.createHttpServer(this.monitoringConfig, this.expressApplication), MODULE_NAME, ServerType.MONITORING_SERVER);
  }
}

