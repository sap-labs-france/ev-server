import express from 'express';
import global from '../../../../../types/GlobalType';

export default class StaticResourceRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    // ##CR - To be removed - introduced only to troubleshoot logo rendering issues in mail (Outlook)
    this.router.use('/images', express.static(`${global.appRoot}/assets/images`));
    return this.router;
  }
}

