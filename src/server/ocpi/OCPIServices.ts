import { Request, Response } from 'express';
import AbstractOCPIService from './AbstractOCPIService';
import { Configuration } from '../../types/configuration/Configuration';
import OCPIService20 from './ocpi-services-impl/ocpi-2.0/OCPIService';
import CPOService from './ocpi-services-impl/ocpi-2.1.1/CPOService';
import OCPIUtils from '../ocpi/OCPIUtils';
import EMSPService from './ocpi-services-impl/ocpi-2.1.1/EMSPService';
import Constants from '../../utils/Constants';

export default class OCPIServices {

  private cpoServices: AbstractOCPIService[] = [];
  private emspServices: AbstractOCPIService[] = [];

  // Create OCPI Service
  constructor(ocpiRestConfig: Configuration['OCPIService']) {
    // Add available OCPI services
    // version 2.1.1
    this.cpoServices.push(new CPOService(ocpiRestConfig));
    this.emspServices.push(new EMSPService(ocpiRestConfig));
    // pragma version 2.0
    this.cpoServices.push(new OCPIService20(ocpiRestConfig, CPOService.PATH));
    this.emspServices.push(new OCPIService20(ocpiRestConfig, EMSPService.PATH));
  }

  /**
   * Get all implemented versions of OCPI
   */
  public getCPOVersions(req: Request, res: Response): void {
    // Get all the versions
    const versions = this.cpoServices.map((ocpiService) => ({ 'version': ocpiService.getVersion(), 'url': ocpiService.getServiceUrl(req) }));
    // Send available versions
    res.json(OCPIUtils.success(versions));
  }

  public getEMSPVersions(req: Request, res: Response): void {
    // Get all the versions
    const versions = this.emspServices.map((ocpiService) => ({ 'version': ocpiService.getVersion(), 'url': ocpiService.getServiceUrl(req) }));
    // Send available versions
    res.json(OCPIUtils.success(versions));
  }

  // Return all OCPI Service Implementation
  public getOCPIServiceImplementations(): AbstractOCPIService[] {
    return this.cpoServices.concat(this.emspServices);
  }
}
