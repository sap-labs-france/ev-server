import AbstractOCPIService from '../../AbstractOCPIService';
import CredentialsEndpoint from './CredentialsEndpoint';
import LocationsEndpoint from './LocationsEndpoint';

const VERSION = "2.1.1";

require('source-map-support').install();

/**
 * OCPI Service 2.1.1  - Implementation
 */export default class OCPIServices extends AbstractOCPIService {
  public registerEndpoint: any;
  // Create OCPI Service
  constructor(ocpiRestConfig) {
    super(ocpiRestConfig, VERSION);

    // register Endpoints
    this.registerEndpoint(new CredentialsEndpoint(this));
    this.registerEndpoint(new LocationsEndpoint(this));
  }
}

