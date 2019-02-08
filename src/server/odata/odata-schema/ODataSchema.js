const oDataSchema = require('./ODataSchema.xml');
const auth = require('basic-auth');
const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
require('source-map-support').install();

class ODataSchema {
  /**
   * Specific implementation to return Atom Schema
   */
  static getSchema(req, res, next) {
    // Login info
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: "ODataServer",
      method: "getSchema", action: "getSchema",
      message: `Requested path: ${req.path} - Original URL: ${req.originalUrl}`
    });

    // set default header
    res.setHeader('Cache-Control', 'no-cache');

    // check authentication
    const authentication = auth(req);

    if (!authentication) {
      res.setHeader('WWW-Authenticate', 'Basic');
      res.send(401);
      return;
    }

    res.setHeader('OData-Version', '4.0');
    // send available versions
    if (req.path === '/' || req.path === '//') {
      res.set('Content-Type', 'text/xml');
      res.send(oDataSchema);
    } else {
      next();
    }
  }
}

module.exports = ODataSchema;