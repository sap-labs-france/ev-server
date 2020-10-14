import CentralRestServerAuthentication from '../CentralRestServerAuthentication';
import { authRouter } from './auth/AuthRouter';
import express from 'express';
import { swaggerRouter } from './doc/SwaggerRouter';
import { tenantRouter } from './api/TenantRouter';

export const globalRouter = express.Router();

// API
globalRouter.use('/v1/api', CentralRestServerAuthentication.authenticate(), tenantRouter);

// Auth
globalRouter.use('/v1/auth', authRouter);

// Docs
globalRouter.use('/v1/docs', swaggerRouter);

