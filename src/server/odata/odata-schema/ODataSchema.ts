import { NextFunction, Request, Response } from 'express';

import CentralServiceApi from '../client/CentralServiceApi';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import auth from 'basic-auth';
import fs from 'fs';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'ODataSchema';

export default class ODataSchema {

  public static restServerUrl = '';

  static async getSchema(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Read XML schema
    const oDataSchema = fs.readFileSync(`${global.appRoot}/assets/server/odata/ODataSchema.xml`, 'utf8');
    // Set default header
    res.setHeader('Cache-Control', 'no-cache');
    // Check authentication
    const authentication = auth(req);
    if (!authentication) {
      res.setHeader('WWW-Authenticate', 'Basic');
      res.send(StatusCodes.UNAUTHORIZED);
      return;
    }
    // Perform a Secure Ping only if root or metadata is requested - otherwise the authentication is checked in the proper REST method call
    try {
      if (req.path === '/' || req.path === '//' || req.path === '/$metadata') {
        // Get tenant from url
        const requestedHost = req.host;
        const split = requestedHost.split('.');
        // Get tenant at first place
        const subdomain = split[0];
        // Build AuthenticatedApi
        const centralServiceApi = new CentralServiceApi(ODataSchema.restServerUrl, authentication.name, authentication.pass, subdomain);
        // Process with the secure Ping
        await centralServiceApi.securePing();
      }
    } catch (error) {
      // Add logging: login info
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'getSchema',
        action: ServerAction.ODATA_SERVER,
        message: 'Unauthorized Access',
        detailedMessages: { error: error.stack }
      });
      res.send(StatusCodes.UNAUTHORIZED);
      return;
    }
    res.setHeader('OData-Version', '4.0');
    // Send available versions
    if (req.path === '/' || req.path === '//') {
      res.set('Content-Type', 'text/xml');
      res.send(oDataSchema);
    } else {
      next();
    }
  }
}
