const OCPIResponse = require('../OCPIResponse');

require('source-map-support').install();

/**
 * Abstract Endpoint
 */
class AbstractEndpoint {
  // Create OCPI Service
  constructor(identifier = "default") {
    this._identifier = identifier;
  }

  // get Endpoint Identifier
  getIdentifier() {
    return this._identifier;
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
    res.status(error.errorCode).json(OCPIResponse.error(error));
  }
}

module.exports = AbstractEndpoint;