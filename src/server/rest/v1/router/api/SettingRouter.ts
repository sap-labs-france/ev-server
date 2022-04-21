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
    this.router.get(`/${RESTServerRoute.REST_SETTINGS}`, (req: Request, res: Response, next: NextFunction) => {
      if (req.query.Identifier) {
        req.query.ID = req.query.Identifier;
        void RouterUtils.handleRestServerAction(SettingService.handleGetSettingByIdentifier.bind(this), ServerAction.SETTING_BY_IDENTIFIER, req, res, next);
      } else {
        void RouterUtils.handleRestServerAction(SettingService.handleGetSettings.bind(this), ServerAction.SETTINGS, req, res, next);
      }
    });
  }

  private buildRouteSetting(): void {
    this.router.get(`/${RESTServerRoute.REST_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      void RouterUtils.handleRestServerAction(SettingService.handleGetSetting.bind(this), ServerAction.SETTING, req, res, next);
    });
  }

  private buildRouteCreateSetting(): void {
    this.router.post(`/${RESTServerRoute.REST_SETTINGS}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleRestServerAction(SettingService.handleCreateSetting.bind(this), ServerAction.SETTING_CREATE, req, res, next);
    });
  }

  private buildRouteUpdateSetting(): void {
    this.router.put(`/${RESTServerRoute.REST_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.id = req.params.id;
      void RouterUtils.handleRestServerAction(SettingService.handleUpdateSetting.bind(this), ServerAction.SETTING_UPDATE, req, res, next);
    });
  }

  private buildRouteDeleteSetting(): void {
    this.router.delete(`/${RESTServerRoute.REST_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      void RouterUtils.handleRestServerAction(SettingService.handleDeleteSetting.bind(this), ServerAction.SETTING_DELETE, req, res, next);
    });
  }
}
