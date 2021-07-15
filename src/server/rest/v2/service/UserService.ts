import { NextFunction, Request, Response } from 'express';

import { ServerAction } from '../../../../types/Server';
import { default as UserServiceV1 } from '../../v1/service/UserService';

export default class UserService {
  public static async handleGetUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Return
    req.query.Status = req.query.UserStatus;
    res.json(await UserServiceV1.handleGetUsers(action, req, res, next));
    next();
  }
}
