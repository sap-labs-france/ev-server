import { NextFunction, Request, Response } from 'express';

import Logging from './Logging';
import { ServerAction } from '../types/Server';
import Utils from './Utils';

export default class RouterUtils {
  public static async handleServerAction(
      handleMethod: (serverAction: ServerAction, req: Request, res: Response, next: NextFunction) => Promise<void>,
      serverAction: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await handleMethod(serverAction, req, res, next);
      next();
    } catch (error) {
      next(error);
      Utils.isDevelopmentEnv() && Logging.logConsoleError(error.stack);
    }
  }
}
