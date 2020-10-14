import express, { NextFunction, Request, Response } from 'express';

import fs from 'fs';
import global from '../../../../types/GlobalType';
import swaggerUi from 'swagger-ui-express';

export const swaggerRouter = express.Router();

const options = {
  explorer: false
};

const oasDocument = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/docs/open-api-standard.json`, 'utf8'));

swaggerRouter.use('/', swaggerUi.serve);

swaggerRouter.get('/', swaggerUi.setup(oasDocument, options));

