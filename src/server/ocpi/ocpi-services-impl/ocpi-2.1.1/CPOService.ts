import AbstractOCPIService from '../../AbstractOCPIService';
import CPOCdrsEndpoint from './CPOCdrsEndpoint';
import CPOCommandsEndpoint from './CPOCommandsEndpoint';
import CPOLocationsEndpoint from './CPOLocationsEndpoint';
import CPOSessionsEndpoint from './CPOSessionsEndpoint';
import CPOTariffsEndpoint from './CPOTariffsEndpoint';
import CPOTokensEndpoint from './CPOTokensEndpoint';
import { Configuration } from '../../../../types/configuration/Configuration';
import CredentialsEndpoint from './CredentialsEndpoint';

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
    this.registerEndpoint(new CPOSessionsEndpoint(this));
    this.registerEndpoint(new CPOCdrsEndpoint(this));
    this.registerEndpoint(new CPOTariffsEndpoint(this));
  }
}

