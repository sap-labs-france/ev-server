import { NextFunction, Request, Response } from 'express';

import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import chalk from 'chalk';

export default class RouterUtils {
  public static async handleServerAction(
      handleMethod: (serverAction: ServerAction, req: Request, res: Response, next: NextFunction) => Promise<void>,
      serverAction: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await handleMethod(serverAction, req, res, next);
      next();
    } catch (error) {
      next(error);
      Utils.isDevelopmentEnv() && console.error(chalk.red(error.stack));
    }
  }
}
