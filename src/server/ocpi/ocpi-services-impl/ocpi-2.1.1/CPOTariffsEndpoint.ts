import { Request, Response } from 'express';

import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOCPIService from '../../AbstractOCPIService';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import Tenant from '../../../../types/Tenant';

const EP_IDENTIFIER = 'tariffs';
const MODULE_NAME = 'CPOTariffsEndpoint';

/**
 * CPO Tariffs Endpoint
 */
export default class CPOTariffsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  async process(req: Request, res: Response, next: Function, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    return null;
  }
}
