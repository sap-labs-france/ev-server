import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';
import Site from '../../../../types/Site';
import UserStorage from '../../../../storage/mongodb/UserStorage';

const EP_IDENTIFIER = 'tokens';
const MODULE_NAME = 'EMSPTokensEndpoint';

const RECORDS_LIMIT = 100;
/**
 * EMSP Tokens Endpoint
 */
export default class EMSPTokensEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    switch (req.method) {
      case 'POST':
        await this.authorizeRequest(req, res, next, tenant);
        break;
      case 'GET':
        await this.getTokensRequest(req, res, next, tenant);
        break;
      default:
        res.sendStatus(501);
        break;
    }
  }

  /**
   * Fetch information about Tokens known in the eMSP systems.
   *
   * /tokens/?date_from=xxx&date_to=yyy
   *
   */
  private async getTokensRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get query parameters
    const offset = (req.query.offset) ? parseInt(req.query.offset) : 0;
    const limit = (req.query.limit && req.query.limit < RECORDS_LIMIT) ? parseInt(req.query.limit) : RECORDS_LIMIT;

    // Get all tokens
    const tokens = await OCPIMapping.getAllTokens(tenant, limit, offset);

    // Set header
    res.set({
      'X-Total-Count': tokens.count,
      'X-Limit': RECORDS_LIMIT
    });

    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, offset, limit, tokens.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }

    res.json(OCPIUtils.success(tokens.result));
  }

  /**
   * Do a ‘real-time’ authorization request to the eMSP system, validating if a Token might be used (at the optionally given Location).
   *
   * /tokens/{token_uid}/authorize?{type=token_type}
   */
  private async authorizeRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const tokenId = urlSegment.shift();
    if (!tokenId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'authorizeRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const user = await UserStorage.getUserByTagId(tenant.id, tokenId);
    if (!user) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'authorizeRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'UNKNOWN USER',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    let allowedStatus = 'NOT_ALLOWED';
    switch (user.status) {
      case Constants.USER_STATUS_ACTIVE:
        allowedStatus = 'ALLOWED';
        break;
      case Constants.USER_STATUS_BLOCKED:
        allowedStatus = 'BLOCKED';
        break;
      case Constants.USER_STATUS_DELETED:
        allowedStatus = 'EXPIRED';
        break;
      default:
        allowedStatus = 'NOT_ALLOWED';
    }

    res.json(OCPIUtils.success({ allowed: allowedStatus }));
  }
}

