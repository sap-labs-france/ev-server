const oDataSchema = require('./ODataSchema.xml');
const auth = require('basic-auth');
const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const CentralServiceApi = require('../client/CentralServiceApi');
require('source-map-support').install();

class ODataSchema {
  /**
   * Specific implementation to return Atom Schema
   */
  static async getSchema(req, res, next) {
    // Login info
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: "ODataServer",
      method: "getSchema", action: "getSchema",
      message: `Requested path: ${req.path} - Original URL: ${req.originalUrl}`
    });

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

module.exports = ODataSchema;