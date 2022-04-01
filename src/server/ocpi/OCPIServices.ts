import AbstractOCPIService from './AbstractOCPIService';
import EMSPCPOService200 from './ocpi-services-impl/ocpi-2.0/OCPIService';
import EMSPService211 from './ocpi-services-impl/ocpi-2.1.1/EMSPService';
import OCPIServiceConfiguration from '../../types/configuration/OCPIServiceConfiguration';

export default class OCPIServices {

  private cpoServices: AbstractOCPIService[] = [];
  private emspServices: AbstractOCPIService[] = [];

  public constructor(ocpiRestConfig: OCPIServiceConfiguration) {
    // version 2.1.1
    this.emspServices.push(new EMSPService211(ocpiRestConfig));
  }

  public getOCPIServiceImplementations(): AbstractOCPIService[] {
    return this.cpoServices.concat(this.emspServices);
  }
}
