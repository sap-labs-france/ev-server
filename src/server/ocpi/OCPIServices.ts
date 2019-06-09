import OCPIService2_1_1 from './ocpi-services-impl/ocpi-2.1.1/OCPIService';
import OCPIService2_0 from './ocpi-services-impl/ocpi-2.0/OCPIService';
import OCPIUtils from '../ocpi/OCPIUtils';
import AbstractOCPIService from './AbstractOCPIService';
import {Request, Response} from 'express';
import { Config } from '../../utils/ConfigurationClasses/Config';

require('source-map-support').install();

export default class OCPIServices {

  private ocpiServices: AbstractOCPIService[] = [];

  // Create OCPI Service
  constructor(ocpiRestConfig: Config['OCPIService']) {
    // add available OCPI services
    // version 2.1.1
    this.ocpiServices.push(new OCPIService2_1_1(ocpiRestConfig));
    // version 2.0
    this.ocpiServices.push(new OCPIService2_0(ocpiRestConfig));
  }
  /**
   * Get all implemented versions of OCPI
   */
  public getVersions(req: Request, res: Response): void {
    // Get all the versions
    const versions = this.ocpiServices.map(ocpiService => {
      return { "version": ocpiService.getVersion(), "url": ocpiService.getServiceUrl(req) };
    });
    // send available versions
    res.json(OCPIUtils.success(versions));
  }

  // Return all OCPI Service Implementation
  public getOCPIServiceImplementations(): AbstractOCPIService[] {
    return this.ocpiServices;
  }
}
