import AbstractOCPIService from '../../AbstractOCPIService';
import CredentialsEndpoint from './CredentialsEndpoint';
import { Configuration } from '../../../../types/configuration/Configuration';
import EMSPLocationsEndpoint from './EMSPLocationsEndpoint';
import EMSPTokensEndpoint from './EMSPTokensEndpoint';
import EMSPSessionsEndpoint from './EMSPSessionsEndpoint';
import EMSPCdrsEndpoint from './EMSPCdrsEndpoint';

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

