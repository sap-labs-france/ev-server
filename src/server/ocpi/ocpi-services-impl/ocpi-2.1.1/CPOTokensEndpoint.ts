import AbstractEndpoint from '../AbstractEndpoint';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AbstractOCPIService from '../../AbstractOCPIService';
import Logging from '../../../../utils/Logging';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';

const EP_IDENTIFIER = 'tokens';
const MODULE_NAME = 'CPOTokensEndpoint';

const RECORDS_LIMIT = 100;
/**
 * EMSP Tokens Endpoint
 */
export default class CPOTokensEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIResponse> {
    switch (req.method) {
      case 'PUT':
      case 'PATCH':
        return this.updateToken(req, res, next, tenant);
      case 'GET':
        return await this.getToken(req, res, next, tenant);
    }
  }

  /**
   * Retrieve a Token as it is stored in the CPO system.
   *
   * /tokens/{country_code}/{party_id}/{token_uid}
   *
   */
  private async getToken(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();

    // Retrieve token
    const token = await OCPIMapping.getToken(tenant, countryCode, partyId, tokenId);

    return OCPIUtils.success(token);
  }

  /**
   * Push new/updated Token object to the CPO.
   *
   * /tokens/{country_code}/{party_id}/{token_uid}
   */
  private async updateToken(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();

    Logging.logDebug(`Updating token ${tokenId} for eMSP ${countryCode}/${partyId}`);

    return OCPIUtils.success();
  }
}

