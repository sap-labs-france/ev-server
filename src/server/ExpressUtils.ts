import express, { NextFunction, Request, Response } from 'express';

import CFLog from 'cf-nodejs-logging-support';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { StatusCodes } from 'http-status-codes';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Utils from '../utils/Utils';
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import jwt from 'jsonwebtoken';
import locale from 'locale';
import morgan from 'morgan';

bodyParserXml(bodyParser);

export default class ExpressUtils {
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
      app.get(Constants.HEALTH_CHECK_ROUTE, ExpressUtils.healthCheckService.bind(this));
    }
    // Use
    app.use(locale(Constants.SUPPORTED_LOCALES));
    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      app.use(CFLog.logNetwork);
    }
    // Log Express Request
    app.use(this.logExpressRequest.bind(this));
    return app;
  }

  public static postInitApplication(app: express.Application): void {
    // Log Express Response
    app.use(Logging.logExpressResponse.bind(this));
    // Error Handling
    app.use(Logging.logExpressError.bind(this));
  }

  private static async logExpressRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Decode the Token
    const decodedToken = this.getDecodedTokenFromHttpRequest(req);
    // Get the Tenant
    const tenantID = await this.retrieveTenantFromHttpRequest(req, decodedToken);
    req['tenantID'] = tenantID;
    await Logging.logExpressRequest(tenantID, decodedToken, req, res, next);
  }

  private static healthCheckService(req: Request, res: Response, next: NextFunction): void {
    res.sendStatus(StatusCodes.OK);
  }

  private static getDecodedTokenFromHttpRequest(req: Request): string | { [key: string]: any; } {
    // Retrieve Tenant ID from JWT token if available
    try {
      if (req.headers?.authorization.startsWith('Bearer')) {
        // Decode the token (REST)
        try {
          return jwt.decode(req.headers.authorization.slice(7));
        } catch (error) {
          // Try Base 64 decoding (OCPI)
          return JSON.parse(Buffer.from(req.headers.authorization.slice(7), 'base64').toString());
        }
      }
    } catch (error) {
      // Do nothing
    }
  }

  private static async retrieveTenantFromHttpRequest(req: Request, decodedToken: any): Promise<string> {
    // Try from Token
    if (decodedToken) {
      // REST
      if (Utils.objectHasProperty(decodedToken, 'tenantID')) {
        return decodedToken.tenantID;
      }
      // OCPI
      if (Utils.objectHasProperty(decodedToken, 'tid')) {
        const tenant = await TenantStorage.getTenantBySubdomain(decodedToken.tid);
        if (tenant) {
          return tenant.id;
        }
      }
    }
    // Try from body
    if (req.body?.tenant !== '') {
      const tenant = await TenantStorage.getTenantBySubdomain(req.body.tenant);
      if (tenant) {
        return tenant.id;
      }
    }
    // Try from host header
    if (req.headers?.host) {
      const hostParts = req.headers.host.split('.');
      if (hostParts.length > 1) {
        // Try with the first param
        const tenant = await TenantStorage.getTenantBySubdomain(hostParts[0]);
        if (tenant) {
          return tenant.id;
        }
      }
    }
    return Constants.DEFAULT_TENANT;
  }
}
