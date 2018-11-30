const OCPIUtils = require('../OCPIUtils');

require('source-map-support').install();

/**
 * Abstract Endpoint
 */
class AbstractEndpoint {
  // Create OCPI Service
  constructor(identifier = "default", version = "0.0.0") {
    this._identifier = identifier;
    this._version = version;
  }

  // get Endpoint Identifier
  getIdentifier() {
    return this._identifier;
  }

  // get Endpoint version
  getVersion() {
    return this._version;
  }

  // Abstract - Process endpoint
  process(req, res, next, tenant) { // eslint-disable-line
    res.sendStatus(501);
  }

  /**
   * Handle error and return correct payload
   */
  _handleError(error, req, res, next, action, module, method) { // eslint-disable-line
    // TODO: add logging

    // return response with error
    res.status(error.errorCode).json(OCPIUtils.error(error));
  }
}

module.exports = AbstractEndpoint;