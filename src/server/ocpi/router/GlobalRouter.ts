import CPORouter from './cpo/CPORouter';
import EMSPRouter from './emsp/EMSPRouter';
import express from 'express';

export default class GlobalRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCPO();
    this.buildRouteEMSP();
    return this.router;
  }

  protected buildRouteCPO(): void {
    this.router.use('/cpo', new CPORouter().buildRoutes());
  }

  protected buildRouteEMSP(): void {
    this.router.use('/emsp', new EMSPRouter().buildRoutes());
  }
}
