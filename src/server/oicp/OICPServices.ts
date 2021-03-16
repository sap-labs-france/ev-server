import AbstractOICPService from './AbstractOICPService';
import CPOService from './oicp-services-impl/oicp-2.3.0/CPOService';
import { Configuration } from '../../types/configuration/Configuration';

export default class OICPServices {

  private cpoServices: AbstractOICPService[] = [];
  // TODO: EMSP
  // private emspServices: AbstractOICPService[] = [];

  // Create OICP Service
  constructor(oicpRestConfig: Configuration['OICPService']) {
    // Add available OICP services
    // version 2.3.0
    this.cpoServices.push(new CPOService(oicpRestConfig));
    // This.emspServices.push(new EMSPService(oicpRestConfig));
  }

  // Return all OICP Service Implementation
  public getOICPServiceImplementations(): AbstractOICPService[] {
    return this.cpoServices; // .concat(this.emspServices);
  }
}
