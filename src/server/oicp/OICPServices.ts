import AbstractOICPService from './AbstractOICPService';
import CPOService from './oicp-services-impl/oicp-2.3.0/CPOService';
import OICPServiceConfiguration from '../../types/configuration/OICPServiceConfiguration';

export default class OICPServices {

  private cpoServices: AbstractOICPService[] = [];
  constructor(oicpRestConfig: OICPServiceConfiguration) {
    // Add available OICP services
    // Version 2.3.0
    this.cpoServices.push(new CPOService(oicpRestConfig));
  }

  public getOICPServiceImplementations(): AbstractOICPService[] {
    return this.cpoServices; // .concat(this.emspServices);
  }
}
