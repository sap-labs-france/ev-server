/* eslint-disable @typescript-eslint/no-misused-promises */
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../../../utils/RouterUtils';
import SettingService from '../../service/SettingService';
import sanitize from 'mongo-sanitize';

export default class SettingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSettings();
    this.buildRouteSetting();
    this.buildRouteCreateSetting();
    this.buildRouteUpdateSetting();
    this.buildRouteDeleteSetting();
    return this.router;
  }

  private buildRouteSettings(): void {
    this.router.get(`/${RESTServerRoute.REST_SETTINGS}`, async (req: Request, res: Response, next: NextFunction) => {
      if (req.query.Identifier) {
        req.query.ID = req.query.Identifier;
        await RouterUtils.handleServerAction(SettingService.handleGetSettingByIdentifier.bind(this), ServerAction.SETTING_BY_IDENTIFIER, req, res, next);
      } else {
        await RouterUtils.handleServerAction(SettingService.handleGetSettings.bind(this), ServerAction.SETTINGS, req, res, next);
      }
    });
  }

  private buildRouteSetting(): void {
    this.router.get(`/${RESTServerRoute.REST_SETTING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(SettingService.handleGetSetting.bind(this), ServerAction.SETTING, req, res, next);
    });
  }

  private buildRouteCreateSetting(): void {
    this.router.post(`/${RESTServerRoute.REST_SETTINGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(SettingService.handleCreateSetting.bind(this), ServerAction.SETTING_CREATE, req, res, next);
    });
  }

  private buildRouteUpdateSetting(): void {
    this.router.put(`/${RESTServerRoute.REST_SETTING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      await RouterUtils.handleServerAction(SettingService.handleUpdateSetting.bind(this), ServerAction.SETTING_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteSetting(): void {
    this.router.delete(`/${RESTServerRoute.REST_SETTING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(SettingService.handleDeleteSetting.bind(this), ServerAction.SETTING_DELETE, req, res, next);
    });
  }
}
