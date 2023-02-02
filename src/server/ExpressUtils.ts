import express, { Application, NextFunction, Request, Response } from 'express';

import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { StatusCodes } from 'http-status-codes';
import Utils from '../utils/Utils';
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import cors from 'cors';
import global from '../types/GlobalType';
import helmet from 'helmet';
import hpp from 'hpp';
import locale from 'locale';
import morgan from 'morgan';
import sanitize from 'express-sanitizer';
import useragent from 'express-useragent';

bodyParserXml(bodyParser);

export default class ExpressUtils {
  public static initApplication(bodyLimit = '1mb', debug = false): Application {
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
    app.use(useragent.express());
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
    // Mount express-sanitizer middleware
    app.use(sanitize());
    app.use(hpp());
    app.use(bodyParser['xml']({
      limit: bodyLimit
    }));
    // Health Check Handling
    app.get(Constants.HEALTH_CHECK_ROUTE, ExpressUtils.healthCheckService.bind(this));
    // Use
    app.use(locale(Constants.SUPPORTED_LOCALES));
    return app;
  }

  public static postInitApplication(expressApplication: Application): void {
    // Error Handling
    expressApplication.use(Logging.traceExpressError.bind(this));
  }

  private static healthCheckService(req: Request, res: Response, next: NextFunction): void {
    // TODO - Find another metric to check the health
    res.sendStatus(StatusCodes.OK);
    // const pingSuccess = await global.database.ping();
    // if (pingSuccess) {
    //   res.sendStatus(StatusCodes.OK);
    // } else {
    //   res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
    // }
  }
}
