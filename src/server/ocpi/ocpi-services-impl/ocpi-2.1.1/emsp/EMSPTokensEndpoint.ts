import { NextFunction, Request, Response } from 'express';
import AppError from '../../../../../exception/AppError';
import ChargingStationStorage from '../../../../../storage/mongodb/ChargingStationStorage';
import TagStorage from '../../../../../storage/mongodb/TagStorage';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPIAllowed } from '../../../../../types/ocpi/OCPIAuthorizationInfo';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPILocationReference } from '../../../../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import { ServerAction } from '../../../../../types/Server';
import Tenant from '../../../../../types/Tenant';
import { UserStatus } from '../../../../../types/User';
import Constants from '../../../../../utils/Constants';
import Utils from '../../../../../utils/Utils';
import AbstractOCPIService from '../../../AbstractOCPIService';
import OCPIUtils from '../../../OCPIUtils';
import AbstractEndpoint from '../../AbstractEndpoint';
import OCPIUtilsService from '../OCPIUtilsService';


const MODULE_NAME = 'EMSPTokensEndpoint';

export default class EMSPTokensEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'tokens');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'POST':
        return this.authorizeRequest(req, res, next, tenant);
      case 'GET':
        return this.getTokensRequest(req, res, next, tenant);
    }
  }

  private async getTokensRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = Utils.convertToInt(req.query.limit) > 0 ? Utils.convertToInt(req.query.limit) : Constants.DB_RECORD_COUNT_NO_LIMIT;
    // Get all tokens
    const tokens = await OCPIUtilsService.getTokens(tenant, limit, offset, Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    // Set header
    res.set({
      'X-Total-Count': tokens.count,
      'X-Limit': Constants.OCPI_RECORDS_LIMIT
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

  private async authorizeRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const tokenID = urlSegment.shift();
    if (!tokenID) {
      throw new AppError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        module: MODULE_NAME, method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const location = req.body as OCPILocationReference;
    if (!location) {
      throw new AppError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        module: MODULE_NAME, method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR,
        message: 'Missing Location data',
        detailedMessages: { tokenID, location }
      });
    }
    if (Utils.isEmptyArray(location.evse_uids)) {
      throw new AppError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        module: MODULE_NAME, method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR,
        message: 'Missing Charging Station ID',
        detailedMessages: { tokenID, location }
      });
    }
    if (location.evse_uids.length > 1) {
      throw new AppError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        module: MODULE_NAME, method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        message: 'Does not support authorization on multiple Charging Stations',
        detailedMessages: { tokenID, location }
      });
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationEvseUid(
      tenant, location.location_id, location.evse_uids[0]);
    if (!chargingStation) {
      throw new AppError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        module: MODULE_NAME, method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        message: `Charging Station with EVSE ID '${location.evse_uids[0]}' and Location ID '${location.location_id}' does not exist`,
        detailedMessages: { tokenID, location }
      });
    }
    const tag = await TagStorage.getTag(tenant, tokenID, { withUser: true });
    if (!tag?.user) {
      throw new AppError({
        action: ServerAction.OCPI_AUTHORIZE_TOKEN,
        module: MODULE_NAME, method: 'authorizeRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        message: `Unkwnown User for OCPI Token ID '${tokenID}'`,
        detailedMessages: { tokenID, location }
      });
    }
    let allowedStatus: OCPIAllowed;
    if (!tag.issuer) {
      allowedStatus = OCPIAllowed.NOT_ALLOWED;
    } else {
      switch (tag.user.status) {
        case UserStatus.ACTIVE:
          allowedStatus = OCPIAllowed.ALLOWED;
          break;
        case UserStatus.BLOCKED:
          allowedStatus = OCPIAllowed.BLOCKED;
          break;
        default:
          allowedStatus = OCPIAllowed.NOT_ALLOWED;
      }
    }
    return OCPIUtils.success({
      allowed: allowedStatus,
      authorization_id: Utils.generateUUID(),
      location: location
    });
  }
}

