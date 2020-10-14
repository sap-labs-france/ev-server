import express, { NextFunction, Request, Response } from 'express';

import AuthService from '../../service/AuthService';
import { ServerAction } from '../../../../types/Server';

export const authRouter = express.Router();

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AuthService.handleLogIn(ServerAction.LOGIN, req, res, next);
    next();
  } catch (error) {
    next(error);
  }
});

