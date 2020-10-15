import AuthService from '../service/AuthService';
import { authRouter } from './auth/AuthRouter';
import express from 'express';
import { swaggerRouter } from './doc/SwaggerRouter';
import { tenantRouter } from './api/TenantRouter';
import { utilRouter } from './util/UtilRouter';

export const globalRouter = express.Router();

// API version 1 routes
const currentVersion = 1;
const currentVersionBaseURI = `/v${currentVersion}`;
// Protected API
globalRouter.use(currentVersionBaseURI + '/api', AuthService.authenticate(), tenantRouter);

// Auth
globalRouter.use(currentVersionBaseURI + '/auth', authRouter);

// Util
globalRouter.use(currentVersionBaseURI + '/utils', utilRouter);

// Docs
globalRouter.use(currentVersionBaseURI + '/docs', swaggerRouter);
