import express, { NextFunction, Request, Response } from 'express';

import { ServerAction } from '../../../../types/Server';
import TenantService from '../../service/TenantService';

export const tenantRouter = express.Router();

// Define the home page route
tenantRouter.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await TenantService.handleGetTenants(ServerAction.TENANTS, req, res, next);
    next();
  } catch (error) {
    next(error);
  }
});

// Define the about route
tenantRouter.get('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.query.ID = req.params.id;
    await TenantService.handleGetTenant(ServerAction.TENANT, req, res, next);
    next();
  } catch (error) {
    next(error);
  }
});

