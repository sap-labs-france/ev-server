const AbstractOCPIService = require('../../AbstractOCPIService');

const VERSION = "2.0";

require('source-map-support').install();

/**
 * OCPI Service 2.0 - Not Implemented - Only used for testing multiple Services declaration
 */
class OCPIServices2_0 extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig) {
    super(ocpiRestConfig, VERSION);
  }

  // Rest Service Implementation
  restService(req, res, next) { // eslint-disable-line
    // not implementated 
    res.sendStatus(501);
  }
}

module.exports = OCPIServices2_0;