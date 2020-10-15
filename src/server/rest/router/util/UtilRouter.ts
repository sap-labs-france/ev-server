import express, { NextFunction, Request, Response } from 'express';

import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';

export const utilRouter = express.Router();

utilRouter.get(`/${ServerAction.REST_PING}`, async (req: Request, res: Response, next: NextFunction) => {
  res.sendStatus(StatusCodes.OK);
});

