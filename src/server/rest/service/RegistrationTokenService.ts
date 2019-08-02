import { NextFunction, Request, Response } from 'express';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import moment from 'moment';
import Logging from '../../../utils/Logging';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import RegistrationTokenSecurity from './security/RegistrationTokenSecurity';
import Utils from '../../../utils/Utils';
import DbParams from '../../../types/database/DbParams';

export default class RegistrationTokenService {
  static async handleCreateRegistrationToken(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Filter
      const filteredRequest = RegistrationTokenSecurity.filterRegistrationTokenCreateRequest(req.body);
      if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && filteredRequest.siteAreaID) {
        // Get the Site Area
        const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
        if (!siteArea) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `The Site Area with ID '${filteredRequest.siteAreaID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
            'RegistrationTokenService', 'handleCreateRegistrationToken', req.user);
        }
        if (!Authorizations.canCreateRegistrationToken(req.user, siteArea.siteID)) {
          // Not Authorized!
          throw new AppAuthError(
            Constants.ACTION_CREATE,
            Constants.ENTITY_TOKEN,
            null,
            Constants.HTTP_AUTH_ERROR,
            'RegistrationTokenService', 'handleCreateRegistrationToken',
            req.user);
        }
      } else if (!Authorizations.canCreateRegistrationToken(req.user, null)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_TOKEN,
          null,
          Constants.HTTP_AUTH_ERROR,
          'RegistrationTokenService', 'handleCreateRegistrationToken',
          req.user);
      }

      const registrationTokenID = await RegistrationTokenStorage.saveRegistrationToken(req.user.tenantID, {
        siteAreaID: filteredRequest.siteAreaID,
        expirationDate: moment().add(1, 'days').toDate(),
        createdBy: { id: req.user.id },
        createdOn: new Date()
      });
      // Ok
      res.json(Object.assign({ id: registrationTokenID }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetRegistrationTokens(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListRegistrationTokens(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TOKENS,
          null,
          Constants.HTTP_AUTH_ERROR,
          'RegistrationTokenService', 'handleGetRegistrationTokens',
          req.user);
      }
      const filteredRequest = RegistrationTokenSecurity.filterRegistrationTokensRequest(req.query);

      const params = {
        siteAreaID: filteredRequest.siteAreaID
      };

      if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION)) {
        params['siteIDs'] = Authorizations.getAuthorizedSiteAdminIDs(req.user);
      }

      const dbParams: DbParams = {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      };

      const registrationTokens = await RegistrationTokenStorage.getRegistrationTokens(req.user.tenantID, params, dbParams);
      // Ok
      res.json(RegistrationTokenSecurity.filterRegistrationTokensResponse(registrationTokens, req.user));
      next();
    } catch (error) {
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
