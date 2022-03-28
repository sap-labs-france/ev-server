import AbstractOCPIService from '../../AbstractOCPIService';
import CPOCdrsEndpoint from './cpo/CPOCdrsEndpoint';
import CPOCommandsEndpoint from './cpo/CPOCommandsEndpoint';
import CPOLocationsEndpoint from './cpo/CPOLocationsEndpoint';
import CPOSessionsEndpoint from './cpo/CPOSessionsEndpoint';
import CPOTariffsEndpoint from './cpo/CPOTariffsEndpoint';
import CPOTokensEndpoint from './cpo/CPOTokensEndpoint';
import CredentialsEndpoint from './credentials/CredentialsEndpoint';
import OCPIServiceConfiguration from '../../../../types/configuration/OCPIServiceConfiguration';

export default class CPOService extends AbstractOCPIService {
  public static readonly VERSION = '2.1.1';
  public static readonly PATH = '/ocpi/cpo';

  public constructor(ocpiRestConfig: OCPIServiceConfiguration) {
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

