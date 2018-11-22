const AbstractEndpoint = require('../AbstractEndpoint');
require('source-map-support').install();

const EP_IDENTIFIER = "credentials";

/**
 * Credentials Endpoint
 */
class CredentialsEndpoint extends AbstractEndpoint {
  constructor() { 
    super(EP_IDENTIFIER);
  }
}


module.exports = CredentialsEndpoint;