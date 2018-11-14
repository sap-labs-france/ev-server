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
  process(req,res,next) { // eslint-disable-line
    res.sendStatus(501);
  }
}

module.exports = AbstractEndpoint;