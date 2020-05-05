import { Configuration } from '../../../../types/configuration/Configuration';
import AbstractOCPIService from '../../AbstractOCPIService';
import CPOLocationsEndpoint from './CPOLocationsEndpoint';
import CPOTokensEndpoint from './CPOTokensEndpoint';
import CredentialsEndpoint from './CredentialsEndpoint';
import CPOCommandsEndpoint from './CPOCommandsEndpoint';

/**
 * OCPI Service 2.1.1  - Implementation
 */
export default class CPOService extends AbstractOCPIService {
  public static readonly VERSION = '2.1.1';
  public static readonly PATH = '/ocpi/cpo';

  // Create OCPI Service
  constructor(ocpiRestConfig: Configuration['OCPIService']) {
    super(ocpiRestConfig, CPOService.PATH, CPOService.VERSION);

    // Register Endpoints
    this.registerEndpoint(new CredentialsEndpoint(this));
    this.registerEndpoint(new CPOLocationsEndpoint(this));
    this.registerEndpoint(new CPOTokensEndpoint(this));
    this.registerEndpoint(new CPOCommandsEndpoint(this));
  }
}

