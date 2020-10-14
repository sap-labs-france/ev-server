import CentralRestServerAuthentication from '../CentralRestServerAuthentication';
import express from 'express';
import { swaggerRouter } from './SwaggerRouter';
import { tenantRouter } from './TenantRouter';

export const globalRouter = express.Router();

// API
globalRouter.use('/v1/api', CentralRestServerAuthentication.authenticate(), tenantRouter);

// Docs
globalRouter.use('/v1/docs', swaggerRouter);

