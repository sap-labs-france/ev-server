/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import SettingService from '../../service/SettingService';
import Utils from '../../../../../utils/Utils';
import sanitize from 'mongo-sanitize';

export default class SettingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSettings();
    this.buildRouteSetting();
    return this.router;
  }

  protected buildRouteSettings(): void {
    this.router.get(`/${ServerRoute.REST_SETTINGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(SettingService.handleGetSettings.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteSetting(): void {
    this.router.get(`/${ServerRoute.REST_SETTING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(SettingService.handleGetSetting.bind(this), ServerAction.SETTING, req, res, next);
    });
  }
}
