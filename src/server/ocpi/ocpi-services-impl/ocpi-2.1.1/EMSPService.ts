import AbstractOCPIService from '../../AbstractOCPIService';
import CredentialsEndpoint from './CredentialsEndpoint';
import CPOLocationsEndpoint from './CPOLocationsEndpoint';
import { Configuration } from '../../../../types/configuration/Configuration';
import Constants from '../../../../utils/Constants';
import EMSPLocationsEndpoint from './EMSPLocationsEndpoint';
import EMSPTokensEndpoint from './EMSPTokensEndpoint';
import EMSPSessionsEndpoint from './EMSPSessionsEndpoint';
import EMSPCdrsEndpoint from './EMSPCdrsEndpoint';

const VERSION = '2.1.1';

/**
 * OCPI Service 2.1.1  - Implementation
 */
export default class EMSPService extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig: Configuration['OCPIService']) {
    super(ocpiRestConfig, Constants.OCPI_SERVER_EMSP_PATH, VERSION);

    // Register Endpoints
    this.registerEndpoint(new CredentialsEndpoint(this));
    this.registerEndpoint(new EMSPLocationsEndpoint(this));
    this.registerEndpoint(new EMSPTokensEndpoint(this));
    this.registerEndpoint(new EMSPSessionsEndpoint(this));
    this.registerEndpoint(new EMSPCdrsEndpoint(this));
  }
}

