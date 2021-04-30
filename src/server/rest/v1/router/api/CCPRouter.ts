import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPPService from '../../service/CCPService';
import RouterUtils from '../RouterUtils';

export default class CCPRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildSwitchCCP();
    return this.router;
  }

  protected buildSwitchCCP(): void {
    this.router.put(`/${ServerRoute.REST_CCP_SWITCH}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CPPService.handleCCPSwitch.bind(this), ServerAction.GET_15118_EV_CERTIFICATE, req, res, next);
    });
  }
}
