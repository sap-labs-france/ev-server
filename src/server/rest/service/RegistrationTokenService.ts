import { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import DbParams from '../../../types/database/DbParams';
import Logging from '../../../utils/Logging';
import RegistrationToken from '../../../types/RegistrationToken';
import RegistrationTokenSecurity from './security/RegistrationTokenSecurity';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import Utils from '../../../utils/Utils';

export default class RegistrationTokenService {
  static async handleCreateRegistrationToken(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Filter
      const filteredRequest = RegistrationTokenSecurity.filterRegistrationTokenCreateRequest(req.body);
      if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && filteredRequest.siteAreaID) {
        // Get the Site Area
        const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
        if (!siteArea) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
            message: `The Site Area with ID '${filteredRequest.siteAreaID}' does not exist anymore`,
            module: 'RegistrationTokenService',
            method: 'handleCreateRegistrationToken',
            user: req.user
          });
        }
        if (!Authorizations.canCreateRegistrationToken(req.user, siteArea.siteID)) {
          // Not Authorized!
          throw new AppAuthError({
            errorCode: Constants.HTTP_AUTH_ERROR,
            user: req.user,
            action: Constants.ACTION_CREATE,
            entity: Constants.ENTITY_TOKEN,
            module: 'RegistrationTokenService',
            method: 'handleCreateRegistrationToken'
          });
        }
      } else if (!Authorizations.canCreateRegistrationToken(req.user, null)) {
        // Not Authorized!
        throw new AppAuthError({
          errorCode: Constants.HTTP_AUTH_ERROR,
          user: req.user,
          action: Constants.ACTION_CREATE,
          entity: Constants.ENTITY_TOKEN,
          module: 'RegistrationTokenService',
          method: 'handleCreateRegistrationToken'
        });
      }

      if (!filteredRequest.description) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: 'The description must be provided',
          module: 'RegistrationTokenService',
          method: 'handleCreateRegistrationToken',
          user: req.user
        });
      }

      const registrationToken: RegistrationToken = {
        siteAreaID: filteredRequest.siteAreaID,
        description: filteredRequest.description,
        expirationDate: filteredRequest.expirationDate ? filteredRequest.expirationDate : moment().add(1, 'month').toDate(),
        createdBy: { id: req.user.id },
        createdOn: new Date()
      };
      const registrationTokenID = await RegistrationTokenStorage.saveRegistrationToken(req.user.tenantID, registrationToken);
      registrationToken.id = registrationTokenID;
      registrationToken.ocpp15SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, Constants.OCPP_VERSION_15, Constants.OCPP_PROTOCOL_SOAP, registrationToken.id);
      registrationToken.ocpp16SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, Constants.OCPP_VERSION_16, Constants.OCPP_PROTOCOL_SOAP, registrationToken.id);
      registrationToken.ocpp16JSONUrl = Utils.buildOCPPServerURL(req.user.tenantID, Constants.OCPP_VERSION_16, Constants.OCPP_PROTOCOL_JSON, registrationToken.id);
      // Ok
      res.json(RegistrationTokenSecurity.filterRegistrationTokenResponse(registrationToken, req.user));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleDeleteRegistrationToken(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      const tokenID = RegistrationTokenSecurity.filterRegistrationTokenByIDRequest(req.query);
      // Check Mandatory fields
      if (!tokenID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: 'Registration Token\'s ID must be provided',
          module: 'RegistrationTokenService',
          method: 'handleDeleteRegistrationToken',
          user: req.user
        });
      }
      // Check auth
      if (!Authorizations.canDeleteRegistrationToken(req.user)) {
        throw new AppAuthError({
          errorCode: Constants.HTTP_AUTH_ERROR,
          user: req.user,
          action: Constants.ACTION_DELETE,
          entity: Constants.ENTITY_TOKEN,
          module: 'RegistrationTokenService',
          method: 'handleDeleteRegistrationToken',
          value: tokenID
        });
      }
      // Check user
      const registrationToken = await RegistrationTokenStorage.getRegistrationToken(req.user.tenantID, tokenID);
      if (!registrationToken) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          message: `Token with ID '${tokenID}' does not exist anymore`,
          module: 'RegistrationTokenService',
          method: 'handleDeleteRegistrationToken',
          user: req.user
        });
      }

      await RegistrationTokenStorage.deleteRegistrationToken(req.user.tenantID, tokenID);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user,
        module: 'RegistrationTokenService', method: 'handleDeleteRegistrationToken',
        message: `Registration token with ID '${tokenID}' has been deleted successfully`,
        action: action
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleRevokeRegistrationToken(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      const tokenID = RegistrationTokenSecurity.filterRegistrationTokenByIDRequest(req.query);
      // Check Mandatory fields
      if (!tokenID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: 'Registration Token\'s ID must be provided',
          module: 'RegistrationTokenService',
          method: 'handleRevokeRegistrationToken',
          user: req.user
        });
      }
      // Check auth
      if (!Authorizations.canUpdateRegistrationToken(req.user)) {
        throw new AppAuthError({
          errorCode: Constants.HTTP_AUTH_ERROR,
          user: req.user,
          action: Constants.ACTION_UPDATE,
          entity: Constants.ENTITY_TOKEN,
          module: 'RegistrationTokenService',
          method: 'handleRevokeRegistrationToken',
          value: tokenID
        });
      }
      // Check user
      const registrationToken = await RegistrationTokenStorage.getRegistrationToken(req.user.tenantID, tokenID);
      if (!registrationToken) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          message: `Token with ID '${tokenID}' does not exist anymore`,
          module: 'RegistrationTokenService',
          method: 'handleRevokeRegistrationToken',
          user: req.user
        });
      }

      registrationToken.revocationDate = new Date();
      registrationToken.lastChangedBy = { 'id': req.user.id };
      registrationToken.lastChangedOn = new Date();
      await RegistrationTokenStorage.saveRegistrationToken(req.user.tenantID, registrationToken);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user,
        module: 'RegistrationTokenService', method: 'handleRevokeRegistrationToken',
        message: `Registration token with ID '${tokenID}' has been revoked successfully`,
        action: action
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
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
        throw new AppAuthError({
          errorCode: Constants.HTTP_AUTH_ERROR,
          user: req.user,
          action: Constants.ACTION_LIST,
          entity: Constants.ENTITY_TOKENS,
          module: 'RegistrationTokenService',
          method: 'handleGetRegistrationTokens'
        });
      }
      const filteredRequest = RegistrationTokenSecurity.filterRegistrationTokensRequest(req.query);

      const params = {
        siteAreaID: filteredRequest.siteAreaID
      };

      if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION)) {
        params['siteIDs'] = Authorizations.getAuthorizedSiteAdminIDs(req.user, null);
      }

      const dbParams: DbParams = {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      };

      const registrationTokens = await RegistrationTokenStorage.getRegistrationTokens(req.user.tenantID, params, dbParams);
      registrationTokens.result.forEach((registrationToken) => {
        registrationToken.ocpp15SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, Constants.OCPP_VERSION_15, Constants.OCPP_PROTOCOL_SOAP, registrationToken.id);
        registrationToken.ocpp16SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, Constants.OCPP_VERSION_16, Constants.OCPP_PROTOCOL_SOAP, registrationToken.id);
        registrationToken.ocpp16JSONUrl = Utils.buildOCPPServerURL(req.user.tenantID, Constants.OCPP_VERSION_16, Constants.OCPP_PROTOCOL_JSON, registrationToken.id);
        return registrationToken;
      });
      // Filter
      RegistrationTokenSecurity.filterRegistrationTokensResponse(registrationTokens, req.user);
      res.json(registrationTokens);
      next();
    } catch (error) {
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
