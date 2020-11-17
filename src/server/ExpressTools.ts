import express, { NextFunction, Request, Response } from 'express';

import { AddressInfo } from 'net';
import CFLog from 'cf-nodejs-logging-support';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServer';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import { StatusCodes } from 'http-status-codes';
import Utils from '../utils/Utils';
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import cluster from 'cluster';
import cors from 'cors';
import fs from 'fs';
import helmet from 'helmet';
import hpp from 'hpp';
import http from 'http';
import https from 'https';
import locale from 'locale';
import morgan from 'morgan';

bodyParserXml(bodyParser);

export default class ExpressTools {
  public static initApplication(bodyLimit = '1mb', debug = false): express.Application {
    const app = express();
    // Secure the application
    app.use(helmet());
    // Cross origin headers
    app.use(cors());
    // Body parser
    app.use(bodyParser.json({
      limit: bodyLimit
    }));
    app.use(bodyParser.urlencoded({
      extended: false,
      limit: bodyLimit
    }));
    // Debug
    if (debug || Utils.isDevelopmentEnv()) {
      app.use(morgan((tokens, req: Request, res: Response) =>
        [
          tokens.method(req, res),
          tokens.url(req, res), '-',
          tokens.status(req, res), '-',
          tokens['response-time'](req, res) + 'ms', '-',
          tokens.res(req, res, 'content-length') / 1024 + 'Kb',
        ].join(' ')
      ));
    }
    app.use(hpp());
    app.use(bodyParser['xml']({
      limit: bodyLimit
    }));
    // Health Check Handling
    if (Configuration.getHealthCheckConfig().enabled) {
      app.get('/health-check', ExpressTools.healthCheckService.bind(this));
    }
    // Use
    app.use(locale(Constants.SUPPORTED_LOCALES));
    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      app.use(CFLog.logNetwork);
    }
    // Log Express Request
    app.use(Logging.logExpressRequest.bind(this));
    return app;
  }

  public static postInitApplication(app: express.Application): void {
    // Log Express Response
    app.use(Logging.logExpressResponse.bind(this));
    // Error Handling
    app.use(Logging.logExpressError.bind(this));
  }

  public static createHttpServer(serverConfig: CentralSystemServerConfiguration, expressApp: express.Application): http.Server {
    let server: http.Server;
    // Create the HTTP server
    if (serverConfig.protocol === 'https') {
      // Create the options
      const options: https.ServerOptions = {};
      // Set the keys
      options.key = fs.readFileSync(serverConfig['ssl-key']);
      options.cert = fs.readFileSync(serverConfig['ssl-cert']);
      // Intermediate cert?
      if (serverConfig['ssl-ca']) {
        // Array?
        if (Array.isArray(serverConfig['ssl-ca'])) {
          options.ca = [];
          // Add all
          for (let i = 0; i < serverConfig['ssl-ca'].length; i++) {
            options.ca.push(fs.readFileSync(serverConfig['ssl-ca'][i]));
          }
        } else {
          // Add one
          options.ca = fs.readFileSync(serverConfig['ssl-ca']);
        }
      }
      // Https server
      server = https.createServer(options, expressApp);
    } else {
      // Http server
      server = http.createServer(expressApp);
    }
    return server;
  }

  public static startServer(serverConfig: CentralSystemServerConfiguration, httpServer: http.Server, serverName: string, serverModuleName: string, listenCb?: () => void, listen = true): void {
    // Default listen callback
    function defaultListenCb(): void {
      // Log
      const logMsg = `${serverName} Server listening on '${serverConfig.protocol}://${ExpressTools.getHttpServerAddress(httpServer)}:${ExpressTools.getHttpServerPort(httpServer)}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: serverModuleName, method: 'startServer',
        action: ServerAction.STARTUP,
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    let cb: () => void;
    if (listenCb && typeof listenCb === 'function') {
      cb = listenCb;
    } else {
      cb = defaultListenCb;
    }
    // Log
    // eslint-disable-next-line no-console
    console.log(`Starting ${serverName} Server ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}...`);

    // Listen
    if (serverConfig.host && serverConfig.port && listen) {
      httpServer.listen(serverConfig.port, serverConfig.host, cb);
    } else if (!serverConfig.host && serverConfig.port && listen) {
      httpServer.listen(serverConfig.port, cb);
    } else if (listen) {
      // eslint-disable-next-line no-console
      console.log(`Fail to start ${serverName} Server listening ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}, missing required port configuration`);
    }
  }

  public static async healthCheckService(req: Request, res: Response, next: NextFunction): Promise<void> {
    res.sendStatus(StatusCodes.OK);
  }

  private static getHttpServerPort(httpServer: http.Server): number {
    return (httpServer.address() as AddressInfo).port;
  }

  private static getHttpServerAddress(httpServer: http.Server): string {
    return (httpServer.address() as AddressInfo).address;
  }
}
