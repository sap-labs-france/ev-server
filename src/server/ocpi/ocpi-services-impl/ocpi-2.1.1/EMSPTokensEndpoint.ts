import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';
import { Status } from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import uuid = require('uuid');
import Utils from '../../../../utils/Utils';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPILocationReference } from '../../../../types/ocpi/OCPILocation';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';

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
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIResponse> {
    switch (req.method) {
      case 'POST':
        return await this.authorizeRequest(req, res, next, tenant);
      case 'GET':
        return await this.getTokensRequest(req, res, next, tenant);
    }
  }

  /**
   * Fetch information about Tokens known in the eMSP systems.
   *
   * /tokens/?date_from=xxx&date_to=yyy
   *
   */
  private async getTokensRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && req.query.limit < RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : RECORDS_LIMIT;

    // Get all tokens
    const tokens = await OCPIMapping.getAllTokens(tenant, limit, offset, req.query.date_from, req.query.date_to);

    // Set header
    res.set({
      'X-Total-Count': tokens.count,
      'X-Limit': RECORDS_LIMIT
    });

    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, this.getBaseUrl(req), offset, limit, tokens.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }

    return OCPIUtils.success(tokens.result);
  }

  /**
   * Do a ‘real-time’ authorization request to the eMSP system, validating if a Token might be used (at the optionally given Location).
   *
   * /tokens/{token_uid}/authorize?{type=token_type}
   */
  private async authorizeRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
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
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const locationReference: OCPILocationReference = req.body;

    if (!locationReference) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing LocationReference',
        ocpiError: OCPIStatusCode.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR
      });
    }
    if (!locationReference.evse_uids || locationReference.evse_uids.length === 0) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing EVSE Id.',
        ocpiError: OCPIStatusCode.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR
      });
    }
    if (locationReference.evse_uids.length > 1) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Invalid or missing parameters : does not support authorization request on multiple EVSE',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const chargingStationId = OCPIUtils.buildChargingStationId(locationReference.location_id, locationReference.evse_uids[0]);
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant.id, chargingStationId);
    if (!chargingStation || chargingStation.issuer) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unknown EVSE ${locationReference.evse_uids[0]}`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOW_LOCATION_ERROR
      });
    }

    const user = await UserStorage.getUserByTagId(tenant.id, tokenId);
    if (!user) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'UNKNOWN USER',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const tag = user.tags.find((value) => value.id === tokenId);

    let allowedStatus;
    if (user.deleted) {
      allowedStatus = 'EXPIRED';
    } else if (!tag.issuer) {
      allowedStatus = 'NOT_ALLOWED';
    } else {
      switch (user.status) {
        case Status.ACTIVE:
          allowedStatus = 'ALLOWED';
          break;
        case Status.BLOCKED:
          allowedStatus = 'BLOCKED';
          break;
        default:
          allowedStatus = 'NOT_ALLOWED';
      }
    }

    return OCPIUtils.success(
      {
        allowed: allowedStatus,
        authorization_id: uuid(),
        location: locationReference
      });
  }
}

