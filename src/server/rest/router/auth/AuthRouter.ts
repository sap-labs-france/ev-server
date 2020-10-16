import express, { NextFunction, Request, Response } from 'express';

import AuthService from '../../service/AuthService';
import RouterUtils from '../RouterUtils';
import { ServerAction } from '../../../../types/Server';

export const authRouter = express.Router();

authRouter.post(`/${ServerAction.SIGNIN}`, async (req: Request, res: Response, next: NextFunction) => {
  await RouterUtils.handleServerAction(AuthService.handleLogIn.bind(this), ServerAction.SIGNIN, req, res, next);
});

authRouter.post(`/${ServerAction.SIGNON}`, async (req: Request, res: Response, next: NextFunction) => {
  await RouterUtils.handleServerAction(AuthService.handleRegisterUser.bind(this), ServerAction.SIGNON, req, res, next);
});

authRouter.get(`/${ServerAction.SIGNOUT}`, async (req: Request, res: Response, next: NextFunction) => {
  await RouterUtils.handleServerAction(AuthService.handleUserLogOut.bind(this), ServerAction.SIGNOUT, req, res, next);
});

authRouter.post(`/${ServerAction.REST_PASSWORD_RESET}`, async (req: Request, res: Response, next: NextFunction) => {
  await RouterUtils.handleServerAction(AuthService.handleUserPasswordReset.bind(this), ServerAction.REST_PASSWORD_RESET, req, res, next);
});
