import AbstractOCPIService from '../../AbstractOCPIService';
import CredentialsEndpoint from './credentials/CredentialsEndpoint';
import OCPIServiceConfiguration from '../../../../types/configuration/OCPIServiceConfiguration';

export default class CPOService extends AbstractOCPIService {
  public static readonly VERSION = '2.1.1';
  public static readonly PATH = '/ocpi/cpo';

  public constructor(ocpiRestConfig: OCPIServiceConfiguration) {
    super(ocpiRestConfig, CPOService.PATH, CPOService.VERSION);
    // Register Endpoints
    this.registerEndpoint(new CredentialsEndpoint(this));
  }
}

