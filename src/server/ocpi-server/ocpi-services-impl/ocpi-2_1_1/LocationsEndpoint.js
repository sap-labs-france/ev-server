const AbstractEndpoint = require('../AbstractEndpoint');

require('source-map-support').install();

const EP_IDENTIFIER = "locations";

/**
 * Locations Endpoint
 */
class LocationsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor() {
    super(EP_IDENTIFIER);
  }


}

module.exports = LocationsEndpoint;