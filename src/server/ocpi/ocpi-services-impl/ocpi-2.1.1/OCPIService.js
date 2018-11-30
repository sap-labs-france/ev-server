const AbstractOCPIService = require('../../AbstractOCPIService');
const CredentialsEndpoint = require('./CredentialsEndpoint');
const LocationsEndpoint = require('./LocationsEndpoint');
const TestsEndpoint = require('./TestsEndpoint');

const VERSION = "2.1.1";

require('source-map-support').install();

/**
 * OCPI Service 2.1.1  - Implementation
 */
class OCPIServices extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig) {
    super(ocpiRestConfig, VERSION);

    // register Endpoints
    this.registerEndpoint(new CredentialsEndpoint());
    this.registerEndpoint(new LocationsEndpoint());
    this.registerEndpoint(new TestsEndpoint());
  }
}

module.exports = OCPIServices;