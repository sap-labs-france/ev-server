import AbstractOCPIService from '../../AbstractOCPIService';
import { Configuration } from '../../../../types/configuration/Configuration';
import CredentialsEndpoint from './CredentialsEndpoint';
import EMSPCdrsEndpoint from './EMSPCdrsEndpoint';
import EMSPCommandsEndpoint from './EMSPCommandsEndpoint';
import EMSPLocationsEndpoint from './EMSPLocationsEndpoint';
import EMSPSessionsEndpoint from './EMSPSessionsEndpoint';
import EMSPTariffsEndpoint from './EMSPTariffsEndpoint';
import EMSPTokensEndpoint from './EMSPTokensEndpoint';

/**
 * OCPI Service 2.1.1  - Implementation
 */
export default class EMSPService extends AbstractOCPIService {
  public static readonly VERSION = '2.1.1';
  public static readonly PATH = '/ocpi/emsp';
  // Create OCPI Service
  constructor(ocpiRestConfig: Configuration['OCPIService']) {
    super(ocpiRestConfig, EMSPService.PATH, EMSPService.VERSION);

    // Register Endpoints
    this.registerEndpoint(new CredentialsEndpoint(this));
    this.registerEndpoint(new EMSPLocationsEndpoint(this));
    this.registerEndpoint(new EMSPTokensEndpoint(this));
    this.registerEndpoint(new EMSPSessionsEndpoint(this));
    this.registerEndpoint(new EMSPCdrsEndpoint(this));
    this.registerEndpoint(new EMSPCommandsEndpoint(this));
    this.registerEndpoint(new EMSPTariffsEndpoint(this));
  }
}

