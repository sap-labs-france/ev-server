import AbstractOCPIService from '../../AbstractOCPIService';
import EMSPCommandsEndpoint from './emsp/EMSPCommandsEndpoint';
import EMSPTariffsEndpoint from './emsp/EMSPTariffsEndpoint';
import OCPIServiceConfiguration from '../../../../types/configuration/OCPIServiceConfiguration';

export default class EMSPService extends AbstractOCPIService {
  public static readonly VERSION = '2.1.1';
  public static readonly PATH = '/ocpi/emsp';

  public constructor(ocpiRestConfig: OCPIServiceConfiguration) {
    super(ocpiRestConfig, EMSPService.PATH, EMSPService.VERSION);
    this.registerEndpoint(new EMSPCommandsEndpoint(this));
    this.registerEndpoint(new EMSPTariffsEndpoint(this));
  }
}
