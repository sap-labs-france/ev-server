import { Request, Response } from 'express';
import AbstractOCPIService from './AbstractOCPIService';
import { Configuration } from '../../types/configuration/Configuration';
import OCPIService20 from './ocpi-services-impl/ocpi-2.0/OCPIService';
import OCPIService211 from './ocpi-services-impl/ocpi-2.1.1/OCPIService';
import OCPIUtils from '../ocpi/OCPIUtils';

export default class OCPIServices {

  private ocpiServices: AbstractOCPIService[] = [];

  // Create OCPI Service
  constructor(ocpiRestConfig: Configuration['OCPIService']) {
    // Add available OCPI services
    // version 2.1.1
    this.ocpiServices.push(new OCPIService211(ocpiRestConfig));
    // pragma version 2.0
    this.ocpiServices.push(new OCPIService20(ocpiRestConfig));
  }

  /**
   * Get all implemented versions of OCPI
   */
  public getVersions(req: Request, res: Response): void {
    // Get all the versions
    const versions = this.ocpiServices.map((ocpiService) => ({ 'version': ocpiService.getVersion(), 'url': ocpiService.getServiceUrl(req) }));
    // Send available versions
    res.json(OCPIUtils.success(versions));
  }

  // Return all OCPI Service Implementation
  public getOCPIServiceImplementations(): AbstractOCPIService[] {
    return this.ocpiServices;
  }
}
