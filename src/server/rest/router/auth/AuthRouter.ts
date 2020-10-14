import express, { NextFunction, Request, Response } from 'express';

import AuthService from '../../service/AuthService';
import RouterUtils from '../RouterUtils';
import { ServerAction } from '../../../../types/Server';

export const authRouter = express.Router();

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  await RouterUtils.handleServerAction(AuthService.handleLogIn.bind(this), ServerAction.LOGIN, req, res, next);
});

