import AbstractEndpoint from '../AbstractEndpoint';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AbstractOCPIService from '../../AbstractOCPIService';
import Logging from '../../../../utils/Logging';

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
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    switch (req.method) {
      case 'PUT':
      case 'PATCH':
        await this.updateToken(req, res, next, tenant);
        break;
      case 'GET':
        await this.getToken(req, res, next, tenant);
        break;
      default:
        res.sendStatus(501);
        break;
    }
  }

  /**
   * Retrieve a Token as it is stored in the CPO system.
   *
   * /tokens/{country_code}/{party_id}/{token_uid}
   *
   */
  private async getToken(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();

    // Retrieve token
    const token = await OCPIMapping.getToken(tenant, countryCode, partyId, tokenId);

    res.json(OCPIUtils.success(token));
  }

  /**
   * Push new/updated Token object to the CPO.
   *
   * /tokens/{country_code}/{party_id}/{token_uid}
   */
  private async updateToken(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tokenId = urlSegment.shift();

    Logging.logDebug(`Updating token ${tokenId} for eMSP ${countryCode}/${partyId}`);
  }
}

