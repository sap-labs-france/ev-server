import AbstractOCPIService from '../../AbstractOCPIService';
import EMSPCdrsEndpoint from './emsp/EMSPCdrsEndpoint';
import EMSPCommandsEndpoint from './emsp/EMSPCommandsEndpoint';
import EMSPSessionsEndpoint from './emsp/EMSPSessionsEndpoint';
import EMSPTariffsEndpoint from './emsp/EMSPTariffsEndpoint';
import OCPIServiceConfiguration from '../../../../types/configuration/OCPIServiceConfiguration';

export default class EMSPService extends AbstractOCPIService {
  public static readonly VERSION = '2.1.1';
  public static readonly PATH = '/ocpi/emsp';

  public constructor(ocpiRestConfig: OCPIServiceConfiguration) {
    super(ocpiRestConfig, EMSPService.PATH, EMSPService.VERSION);
    this.registerEndpoint(new EMSPSessionsEndpoint(this));
    this.registerEndpoint(new EMSPCdrsEndpoint(this));
    this.registerEndpoint(new EMSPCommandsEndpoint(this));
    this.registerEndpoint(new EMSPTariffsEndpoint(this));
  }
}
