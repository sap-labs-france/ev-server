import AbstractOICPService from '../../AbstractOICPService';
import CPORemoteAuthorizationsEndpoint from './CPORemoteAuthorizationsEndpoint';
import OICPServiceConfiguration from '../../../../types/configuration/OICPServiceConfiguration';
import { OICPVersion } from '../../../../types/oicp/OICPGeneral';

export default class CPOService extends AbstractOICPService {
  public static readonly VERSION = OICPVersion.V230;
  public static readonly PATH = '/:protocol/:role/:version/:tenantSubdomain/api/oicp/:module/:endpointVersion/providers/:providerID/:endpoint/:endpointAction?';

  // Create OICP Service
  constructor(oicpRestConfig: OICPServiceConfiguration) {
    super(oicpRestConfig, CPOService.PATH, CPOService.VERSION);

    // Register Endpoints
    this.registerEndpoint(new CPORemoteAuthorizationsEndpoint(this));
  }
}
