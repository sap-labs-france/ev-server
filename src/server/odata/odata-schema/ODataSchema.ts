import oDataSchema from './ODataSchema.xml';
import auth from 'basic-auth';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import CentralServiceApi from '../client/CentralServiceApi';
require('source-map-support').install();

export default class ODataSchema {
  
  public static restServerUrl: string = '';

  static async getSchema(req, res, next) {
    // Set default header
    res.setHeader('Cache-Control', 'no-cache');
    // Check authentication
    const authentication = auth(req);
    if (!authentication) {
      res.setHeader('WWW-Authenticate', 'Basic');
      res.send(401);
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
      // Login info
      // add logging
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: "ODataServer",
        source: "ODataServer",
        method: "securePing",
        action: "SecurePing",
        message: 'Unauthorized Access'
      });

      res.send(401);
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
