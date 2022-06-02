import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import ChargingStationStorage from '../../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../../utils/Constants';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPIAllowed } from '../../../../../types/ocpi/OCPIAuthorizationInfo';
import { OCPILocationReference } from '../../../../../types/ocpi/OCPILocation';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import TagStorage from '../../../../../storage/mongodb/TagStorage';
import { UserStatus } from '../../../../../types/User';
import UserStorage from '../../../../../storage/mongodb/UserStorage';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'EMSPTokensService';

export default class EMSPTokensService {
  public static async handleGetTokens(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = Utils.convertToInt(req.query.limit) > 0 ? Utils.convertToInt(req.query.limit) : Constants.DB_RECORD_COUNT_NO_LIMIT;
    // Get all tokens
    const tokens = await OCPIUtilsService.getEmspTokensFromTags(
      tenant, limit, offset, Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    // Set header
    res.set({
      'X-Total-Count': tokens.count,
      'X-Limit': Constants.OCPI_RECORDS_LIMIT
    });
    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, OCPIUtilsService.getBaseUrl(req), offset, limit, tokens.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }
    res.json(OCPIUtils.success(tokens.result));
    next();
  }

  public static async handleAuthorizeToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const tokenID = urlSegment.shift();
    if (!tokenID) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleAuthorizeToken', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const location = req.body as OCPILocationReference;
    if (!location) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleAuthorizeToken', action,
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR,
        message: 'Missing Location data',
        detailedMessages: { tokenID, location }
      });
    }
    if (Utils.isEmptyArray(location.evse_uids)) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleAuthorizeToken', action,
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR,
        message: 'Missing Charging Station ID',
        detailedMessages: { tokenID, location }
      });
    }
    if (location.evse_uids.length > 1) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleAuthorizeToken', action,
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
        module: MODULE_NAME, method: 'handleAuthorizeToken', action,
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        message: `Charging Station with EVSE ID '${location.evse_uids[0]}' and Location ID '${location.location_id}' does not exist`,
        detailedMessages: { tokenID, location }
      });
    }
    const tag = await TagStorage.getTag(tenant, tokenID, { withUser: true });
    if (!tag) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleAuthorizeToken', action,
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        message: `Unkwnown Tag ID '${tokenID}'`,
        detailedMessages: { tokenID, location }
      });
    }
    // Check Tag
    if (!tag.issuer || !tag.active) {
      res.json(OCPIUtils.success({
        allowed: OCPIAllowed.NOT_ALLOWED,
        authorization_id: Utils.generateUUID(), location
      }));
      next();
      return;
    }
    // Check User
    const user = tag.user;
    if (!user) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleAuthorizeToken', action,
        errorCode: HTTPError.GENERAL_ERROR,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        message: `Unkwnown User for OCPI Token ID '${tokenID}'`,
        detailedMessages: { tokenID, location, tag }
      });
    }
    if (user.status !== UserStatus.ACTIVE) {
      res.json(OCPIUtils.success({
        allowed: tag.user.status === UserStatus.BLOCKED ? OCPIAllowed.BLOCKED : OCPIAllowed.NOT_ALLOWED,
        authorization_id: Utils.generateUUID(), location
      }));
      next();
      return;
    }
    // Generate and Save Auth ID
    user.authorizationID = Utils.generateUUID();
    await UserStorage.saveUser(tenant, user);
    res.json(OCPIUtils.success({
      allowed: OCPIAllowed.ALLOWED,
      authorization_id: user.authorizationID,
      location
    }));
    next();
  }
}

