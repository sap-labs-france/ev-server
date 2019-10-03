import AbstractOCPIService from '../../AbstractOCPIService';
import CredentialsEndpoint from './CredentialsEndpoint';
import LocationsEndpoint from './LocationsEndpoint';
import Config from '../../../../types/configuration/Config';

const VERSION = '2.1.1';

/**
 * OCPI Service 2.1.1  - Implementation
 */
export default class OCPIService extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig: Config['OCPIService']) {
    super(ocpiRestConfig, VERSION);

    // Register Endpoints
    this.registerEndpoint(new CredentialsEndpoint(this));
    this.registerEndpoint(new LocationsEndpoint(this));
  }
}

