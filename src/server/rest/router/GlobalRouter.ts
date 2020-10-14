import AuthService from '../service/AuthService';
import { authRouter } from './auth/AuthRouter';
import express from 'express';
import { swaggerRouter } from './doc/SwaggerRouter';
import { tenantRouter } from './api/TenantRouter';

export const globalRouter = express.Router();

// API
globalRouter.use('/v1/api', AuthService.authenticate(), tenantRouter);

// Auth
globalRouter.use('/v1/auth', authRouter);

// Docs
globalRouter.use('/v1/docs', swaggerRouter);

