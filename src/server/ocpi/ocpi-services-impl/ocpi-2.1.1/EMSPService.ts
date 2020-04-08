import { Configuration } from '../../../../types/configuration/Configuration';
import AbstractOCPIService from '../../AbstractOCPIService';
import CredentialsEndpoint from './CredentialsEndpoint';
import EMSPCdrsEndpoint from './EMSPCdrsEndpoint';
import EMSPLocationsEndpoint from './EMSPLocationsEndpoint';
import EMSPSessionsEndpoint from './EMSPSessionsEndpoint';
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
  }
}

