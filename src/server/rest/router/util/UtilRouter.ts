import express, { NextFunction, Request, Response } from 'express';

import { StatusCodes } from 'http-status-codes';

export const utilRouter = express.Router();

utilRouter.get('/ping', async (req: Request, res: Response, next: NextFunction) => {
  res.sendStatus(StatusCodes.OK);
});

