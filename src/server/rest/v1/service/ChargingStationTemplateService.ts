import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import ChargingStationTemplate from '../../../../types/ChargingStation';
import { ChargingStationTemplateDataResult } from '../../../../types/DataResult';
import ChargingStationTemplateStorage from '../../../../storage/mongodb/ChargingStationTemplateStorage';
import ChargingStationTemplateValidator from '../validator/ChargingStationTemplateValidator';
import { ServerAction } from '../../../../types/Server';
import { TenantComponents } from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'ChargingStationTemplateService';

export default class ChargingStationTemplateService {
  // public static async handleCreateRegistrationToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
  //   // Filter
  //   const filteredRequest = RegistrationTokenValidator.getInstance().validateRegistrationTokenCreateReq(req.body);
  //   // Check the Site Area
  //   if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredRequest.siteAreaID) {
  //     await UtilsService.checkAndGetSiteAreaAuthorization(
  //       req.tenant, req.user, filteredRequest.siteAreaID, Action.UPDATE, action, filteredRequest, null, false);
  //   }
  //   // Get dynamic auth
  //   const authorizationFilter = await AuthorizationService.checkAndGetRegistrationTokenAuthorizations(req.tenant, req.user, {}, Action.CREATE, filteredRequest);
  //   if (!authorizationFilter.authorized) {
  //     throw new AppAuthError({
  //       errorCode: HTTPAuthError.FORBIDDEN,
  //       user: req.user,
  //       action: Action.CREATE, entity: Entity.REGISTRATION_TOKEN,
  //       module: MODULE_NAME, method: 'handleCreateRegistrationToken'
  //     });
  //   }
  //   // Create
  //   const registrationToken: RegistrationToken = {
  //     siteAreaID: filteredRequest.siteAreaID,
  //     description: filteredRequest.description,
  //     expirationDate: filteredRequest.expirationDate ? filteredRequest.expirationDate : moment().add(1, 'month').toDate(),
  //     createdBy: { id: req.user.id },
  //     createdOn: new Date()
  //   };
  //   // Save
  //   registrationToken.id = await RegistrationTokenStorage.saveRegistrationToken(req.tenant, registrationToken);
  //   await Logging.logInfo({
  //     // ...LoggingHelper.getRegistrationTokenProperties(registrationToken),
  //     tenantID: req.tenant.id,
  //     user: req.user, module: MODULE_NAME, method: 'handleCreateRegistrationToken',
  //     message: `Registration Token '${registrationToken.description}' has been created successfully`,
  //     action, detailedMessages: { registrationToken }
  //   });
  //   res.json(Object.assign({ id: registrationToken.id }, Constants.REST_RESPONSE_SUCCESS));
  //   next();
  // }

  // public static async handleUpdateRegistrationToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
  //   // Filter
  //   const filteredRequest = RegistrationTokenValidator.getInstance().validateRegistrationTokenUpdateReq(req.body);
  //   // Check and Get Registration Token
  //   const registrationToken = await UtilsService.checkAndGetRegistrationTokenAuthorization(
  //     req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
  //   // Check the Site Area
  //   if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && filteredRequest.siteAreaID) {
  //     await UtilsService.checkAndGetSiteAreaAuthorization(
  //       req.tenant, req.user, filteredRequest.siteAreaID, Action.READ, action, filteredRequest, null, false);
  //   }
  //   // Update
  //   registrationToken.siteAreaID = filteredRequest.siteAreaID;
  //   registrationToken.description = filteredRequest.description;
  //   registrationToken.expirationDate = filteredRequest.expirationDate ? filteredRequest.expirationDate : moment().add(1, 'month').toDate();
  //   registrationToken.lastChangedBy = { id: req.user.id };
  //   registrationToken.lastChangedOn = new Date();
  //   registrationToken.revocationDate = null;
  //   // Save
  //   await RegistrationTokenStorage.saveRegistrationToken(req.tenant, registrationToken);
  //   await Logging.logInfo({
  //     ...LoggingHelper.getRegistrationTokenProperties(registrationToken),
  //     tenantID: req.tenant.id,
  //     user: req.user, module: MODULE_NAME, method: 'handleUpdateRegistrationToken',
  //     message: `Registration Token '${registrationToken.description}' has been updated successfully`,
  //     action, detailedMessages: { registrationToken }
  //   });
  //   res.json(Constants.REST_RESPONSE_SUCCESS);
  //   next();
  // }

  // public static async handleDeleteRegistrationToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
  //   // Filter
  //   const registrationTokenID = RegistrationTokenValidator.getInstance().validateRegistrationTokenGetReq(req.query).ID;
  //   // Check and Get Registration Token
  //   const registrationToken = await UtilsService.checkAndGetRegistrationTokenAuthorization(
  //     req.tenant, req.user, registrationTokenID, Action.DELETE, action);
  //   // Delete
  //   await RegistrationTokenStorage.deleteRegistrationToken(req.tenant, registrationToken.id);
  //   await Logging.logInfo({
  //     ...LoggingHelper.getRegistrationTokenProperties(registrationToken),
  //     tenantID: req.tenant.id,
  //     user: req.user,
  //     module: MODULE_NAME, method: 'handleDeleteRegistrationToken',
  //     message: `Registration token with ID '${registrationTokenID}' has been deleted successfully`,
  //     action, detailedMessages: { registrationToken }
  //   });
  //   res.json(Constants.REST_RESPONSE_SUCCESS);
  //   next();
  // }

  // public static async handleRevokeRegistrationToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
  //   // Filter
  //   const registrationTokenID = RegistrationTokenValidator.getInstance().validateRegistrationTokenGetReq(req.query).ID;
  //   // Check and Get Registration Token
  //   const registrationToken = await UtilsService.checkAndGetRegistrationTokenAuthorization(
  //     req.tenant, req.user, registrationTokenID, Action.REVOKE, action, null, {}, true);
  //   if (registrationToken.expirationDate &&
  //       moment(registrationToken.expirationDate).isBefore(new Date())) {
  //     throw new AppError({
  //       ...LoggingHelper.getRegistrationTokenProperties(registrationToken),
  //       errorCode: HTTPError.GENERAL_ERROR,
  //       message: 'Cannot revoke a token that has expired',
  //       module: MODULE_NAME, method: 'handleRevokeRegistrationToken',
  //       user: req.user
  //     });
  //   }
  //   // Update
  //   const now = new Date();
  //   registrationToken.revocationDate = now;
  //   registrationToken.lastChangedBy = { 'id': req.user.id };
  //   registrationToken.lastChangedOn = now;
  //   // Save
  //   await RegistrationTokenStorage.saveRegistrationToken(req.tenant, registrationToken);
  //   await Logging.logInfo({
  //     ...LoggingHelper.getRegistrationTokenProperties(registrationToken),
  //     tenantID: req.tenant.id,
  //     user: req.user,
  //     module: MODULE_NAME, method: 'handleRevokeRegistrationToken',
  //     message: `Registration token with ID '${registrationTokenID}' has been revoked successfully`,
  //     action: action
  //   });
  //   res.json(Constants.REST_RESPONSE_SUCCESS);
  //   next();
  // }

  public static async handleGetChargingStationTemplates(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplatesGetReq(req.query);
    // Check dynamic auth
    const authorizationChargingStationTemplateFilter = await AuthorizationService.checkAndGetChargingStationTemplatesAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationChargingStationTemplateFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the tokens
    const chargingStationTemplates = await ChargingStationTemplateStorage.getChargingStationTemplates(req.tenant,
      {
        search: filteredRequest.Search,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        ...authorizationChargingStationTemplateFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationChargingStationTemplateFilter.projectFields
    );
    // Assign projected fields
    if (authorizationChargingStationTemplateFilter.projectFields) {
      chargingStationTemplates.projectFields = authorizationChargingStationTemplateFilter.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addChargingStationTemplatesAuthorizations(req.tenant, req.user, chargingStationTemplates as ChargingStationTemplateDataResult, authorizationChargingStationTemplateFilter);
    res.json(chargingStationTemplates);
    next();
  }

  public static async handleGetChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateGetReq(req.query);
    // Check and Get Registration Token
    const chargingStationTemplate = await UtilsService.checkAndGetChargingStationTemplateAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {}, true);
    res.json(chargingStationTemplate);
    next();
  }
}

