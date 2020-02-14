import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import RegistrationTokenStorage from '../../../storage/mongodb/RegistrationTokenStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import DbParams from '../../../types/database/DbParams';
import { OCPPProtocol, OCPPVersion } from '../../../types/ocpp/OCPPServer';
import RegistrationToken from '../../../types/RegistrationToken';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import RegistrationTokenSecurity from './security/RegistrationTokenSecurity';

export default class RegistrationTokenService {
  static async handleCreateRegistrationToken(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Filter
      const filteredRequest = RegistrationTokenSecurity.filterRegistrationTokenCreateRequest(req.body);
      if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && filteredRequest.siteAreaID) {
        // Get the Site Area
        const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
        if (!siteArea) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
            message: `The Site Area with ID '${filteredRequest.siteAreaID}' does not exist anymore`,
            module: 'RegistrationTokenService',
            method: 'handleCreateRegistrationToken',
            user: req.user
          });
        }
        if (!Authorizations.canCreateRegistrationToken(req.user, siteArea.siteID)) {
          // Not Authorized!
          throw new AppAuthError({
            errorCode: HTTPAuthError.ERROR,
            user: req.user,
            action: Action.CREATE,
            entity: Entity.TOKEN,
            module: 'RegistrationTokenService',
            method: 'handleCreateRegistrationToken'
          });
        }
      } else if (!Authorizations.canCreateRegistrationToken(req.user, null)) {
        // Not Authorized!
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.CREATE,
          entity: Entity.TOKEN,
          module: 'RegistrationTokenService',
          method: 'handleCreateRegistrationToken'
        });
      }

      if (!filteredRequest.description) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
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
      registrationToken.ocpp15SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, OCPPVersion.VERSION_15, OCPPProtocol.SOAP, registrationToken.id);
      registrationToken.ocpp16SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, OCPPVersion.VERSION_16, OCPPProtocol.SOAP, registrationToken.id);
      registrationToken.ocpp16JSONUrl = Utils.buildOCPPServerURL(req.user.tenantID, OCPPVersion.VERSION_16, OCPPProtocol.JSON, registrationToken.id);
      // Ok
      res.json(RegistrationTokenSecurity.filterRegistrationTokenResponse(registrationToken, req.user));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleDeleteRegistrationToken(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      const tokenID = RegistrationTokenSecurity.filterRegistrationTokenByIDRequest(req.query);
      // Check Mandatory fields
      if (!tokenID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Registration Token\'s ID must be provided',
          module: 'RegistrationTokenService',
          method: 'handleDeleteRegistrationToken',
          user: req.user
        });
      }
      // Check auth
      if (!Authorizations.canDeleteRegistrationToken(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.DELETE,
          entity: Entity.TOKEN,
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
          errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
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

  static async handleRevokeRegistrationToken(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      const tokenID = RegistrationTokenSecurity.filterRegistrationTokenByIDRequest(req.query);
      // Check Mandatory fields
      if (!tokenID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Registration Token\'s ID must be provided',
          module: 'RegistrationTokenService',
          method: 'handleRevokeRegistrationToken',
          user: req.user
        });
      }
      // Check auth
      if (!Authorizations.canUpdateRegistrationToken(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE,
          entity: Entity.TOKEN,
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
          errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
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

  static async handleGetRegistrationTokens(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListRegistrationTokens(req.user)) {
        // Not Authorized!
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TOKENS,
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
        registrationToken.ocpp15SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, OCPPVersion.VERSION_15, OCPPProtocol.SOAP, registrationToken.id);
        registrationToken.ocpp16SOAPUrl = Utils.buildOCPPServerURL(req.user.tenantID, OCPPVersion.VERSION_16, OCPPProtocol.SOAP, registrationToken.id);
        registrationToken.ocpp16JSONUrl = Utils.buildOCPPServerURL(req.user.tenantID, OCPPVersion.VERSION_16, OCPPProtocol.JSON, registrationToken.id);
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
