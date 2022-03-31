/* eslint-disable @typescript-eslint/no-misused-promises */
import express from 'express';

export default class EMSPRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    return this.router;
  }
}
