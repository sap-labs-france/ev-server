import AbstractOICPService from '../../AbstractOICPService';
import CPORemoteAuthorizationsEndpoint from './CPORemoteAuthorizationsEndpoint';
import { Configuration } from '../../../../types/configuration/Configuration';
import { OICPVersion } from '../../../../types/oicp/OICPGeneral';

/**
 * OICP Service 2.3.0  - Implementation
 */
export default class CPOService extends AbstractOICPService {
  public static readonly VERSION = OICPVersion.V230;
  public static readonly PATH = '/:protocol/:role/:version/:tenantSubdomain/api/oicp/:module/:endpointVersion/providers/:providerID/:endpoint/:endpointAction?';

  // Create OICP Service
  constructor(oicpRestConfig: Configuration['OICPService']) {
    super(oicpRestConfig, CPOService.PATH, CPOService.VERSION);

    // Register Endpoints
    this.registerEndpoint(new CPORemoteAuthorizationsEndpoint(this));
  }
}
