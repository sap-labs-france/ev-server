import * as HttpStatus from 'http-status-codes';
import { NextFunction, Request, Response } from 'express';
import CFLog from 'cf-nodejs-logging-support';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import cluster from 'cluster';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import hpp from 'hpp';
import http from 'http';
import https from 'https';
import locale from 'locale';

bodyParserXml(bodyParser);

export default class ExpressTools {
  public static init(bodyLimit = '1mb'): express.Application {
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
    app.use(hpp());
    app.use(bodyParser['xml']({
      limit: bodyLimit
    }));
    // Health Check Handling
    if (Configuration.getHealthCheckConfig().enabled) {
      app.use('/health-check', ExpressTools.healthCheckService);
    }
    // Use
    app.use(locale(Configuration.getLocalesConfig().supported));
    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      app.use(CFLog.logNetwork);
    }
    return app;
  }

  public static createHttpServer(serverConfig: any, expressApp: express.Application): http.Server {
    let server: http.Server;
    // Create the HTTP server
    if (serverConfig.protocol === 'https') {
      // Create the options
      const options: any = {};
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

  public static startServer(serverConfig: any, httpServer: any, serverName: string, serverModuleName: any, listenCb?: Function, listen = true): void {
    // Default listen callback
    function defaultListenCb(): void {
      // Log
      const logMsg = `${serverName} Server listening on '${serverConfig.protocol}://${httpServer.address().address}:${httpServer.address().port}'`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: serverModuleName,
        method: 'start', action: 'Startup',
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg + ` ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);
    }
    let cb: Function;
    if (listenCb && typeof listenCb === 'function') {
      cb = listenCb;
    } else {
      cb = defaultListenCb;
    }
    // Log
    const logMsg = `Starting ${serverName} Server ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}...`;
    // eslint-disable-next-line no-console
    console.log(logMsg);

    // Listen
    if (serverConfig.host && serverConfig.port && listen) {
      httpServer.listen(serverConfig.port, serverConfig.host, cb);
    } else if (!serverConfig.host && serverConfig.port && listen) {
      httpServer.listen(serverConfig.port, cb);
    } else if (listen) {
      // eslint-disable-next-line no-console
      console.log(`Fail to start ${serverName} Server listening ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}, missing required port configuration`);
    }
  }

  public static async healthCheckService(req: Request, res: Response, next: NextFunction) {
    res.sendStatus(HttpStatus.OK);
  }
}
