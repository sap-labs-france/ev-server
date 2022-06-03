import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import { ChargingStationTemplate } from '../../../../types/ChargingStation';
import { ChargingStationTemplateDataResult } from '../../../../types/DataResult';
import ChargingStationTemplateStorage from '../../../../storage/mongodb/ChargingStationTemplateStorage';
import ChargingStationTemplateValidator from '../validator/ChargingStationTemplateValidator';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ChargingStationTemplateService';

export default class ChargingStationTemplateService {
  public static async handleCreateChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateCreateReq(req.body);
    await AuthorizationService.checkAndGetChargingStationTemplateAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    const foundTemplate = await ChargingStationTemplateStorage.getChargingStationTemplate(filteredRequest.id);
    if (foundTemplate) {
      throw new AppError({
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `id '${filteredRequest.id}' already exists`,
        module: MODULE_NAME, method: 'handleCreateChargingStationTemplate',
        user: req.user,
        action: action
      });
    }
    // Check auth
    if (!(await Authorizations.canCreateChargingStationTemplate(req.user))) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.CHARGING_STATION_TEMPLATE,
        module: MODULE_NAME, method: 'handleCreateChargingStationTemplate'
      });
    }
    const newChargingStationTemplate: ChargingStationTemplate = {
      id: filteredRequest.id,
      hash: filteredRequest.hash,
      hashCapabilities: filteredRequest.hashCapabilities,
      hashTechnical: filteredRequest.hashTechnical,
      hashOcppStandard: filteredRequest.hashOcppStandard,
      hashOcppVendor: filteredRequest.hashOcppVendor,
      chargePointVendor: filteredRequest.chargePointVendor,
      capabilities: filteredRequest.capabilities,
      ocppStandardParameters: filteredRequest.ocppStandardParameters,
      ocppVendorParameters: filteredRequest.ocppVendorParameters,
      createdOn: new Date(),
      extraFilters: filteredRequest.extraFilters,
      technical: filteredRequest.technical
    };

    newChargingStationTemplate.id = await ChargingStationTemplateStorage.saveChargingStationTemplate(newChargingStationTemplate);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleCreateChargingStationTemplate',
      message: `ChargingStationTemplate '${newChargingStationTemplate.id}' has been created successfully`,
      action: action,
      detailedMessages: { chargingStationTemplate: newChargingStationTemplate }
    });
    res.json(Object.assign({ id: newChargingStationTemplate.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

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
    const chargingStationTemplates = await ChargingStationTemplateStorage.getChargingStationTemplates(
      {
        search: filteredRequest.Search,
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
    // eslint-disable-next-line max-len
    await AuthorizationService.addChargingStationTemplatesAuthorizations(req.tenant, req.user, chargingStationTemplates as ChargingStationTemplateDataResult, authorizationChargingStationTemplateFilter);
    res.json(chargingStationTemplates);
    next();
  }

  public static async handleGetChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateGetReq(req.body);
    // Check and Get Registration Token
    const chargingStationTemplate = await UtilsService.checkAndGetChargingStationTemplateAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.READ, action, null, {}, true);
    res.json(chargingStationTemplate);
    next();
  }

  public static async handleDeleteChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const chargingStationTemplateID = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateDeleteReq(req.body).id;
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, chargingStationTemplateID, MODULE_NAME,
      'handleDeleteChargingStationTemplate', req.user);
    // Get
    const chargingStationTemplate = await ChargingStationTemplateStorage.getChargingStationTemplate(chargingStationTemplateID);
    UtilsService.assertObjectExists(action, chargingStationTemplate, `Charging StationTemplate ID '${chargingStationTemplateID}' does not exist`,
      MODULE_NAME, 'handleDeleteChargingStationTemplate', req.user);
    // Check auth
    if (!await Authorizations.canDeleteChargingStationTemplate(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.CHARGING_STATION_TEMPLATE,
        module: MODULE_NAME, method: 'handleDeleteChargingStationTemplate',
        value: chargingStationTemplateID,
      });
    }
    // Delete physically
    await ChargingStationTemplateStorage.deleteChargingStationTemplate(req.tenant, chargingStationTemplate.id);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteChargingStationTemplate',
      message: `Charging Station Template'${chargingStationTemplate.id}' has been deleted successfully`,
      action,
      detailedMessages: { chargingStationTemplate }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateUpdateReq(req.body);
    await AuthorizationService.checkAndGetChargingStationTemplateAuthorizations(
      req.tenant, req.user, filteredRequest, Action.UPDATE);
    const chargingStationTemplate = await ChargingStationTemplateStorage.getChargingStationTemplate(filteredRequest.id);
    UtilsService.assertObjectExists(action, chargingStationTemplate, `Charging Station Template '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateChargingStationTemplate', req.user);
    // Check auth
    if (!(await Authorizations.canUpdateChargingStationTemplate(req.user))) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IMPORT, entity: Entity.CHARGING_STATION_TEMPLATE,
        module: MODULE_NAME, method: 'handleUpdateChargingStationTemplate'
      });
    }
    const newChargingStationTemplate: ChargingStationTemplate = {
      id: filteredRequest.id,
      hash: filteredRequest.hash,
      hashCapabilities: filteredRequest.hashCapabilities,
      hashTechnical: filteredRequest.hashTechnical,
      hashOcppStandard: filteredRequest.hashOcppStandard,
      hashOcppVendor: filteredRequest.hashOcppVendor,
      chargePointVendor: filteredRequest.chargePointVendor,
      capabilities: filteredRequest.capabilities,
      ocppStandardParameters: filteredRequest.ocppStandardParameters,
      ocppVendorParameters: filteredRequest.ocppVendorParameters,
      createdOn: new Date(),
      extraFilters: filteredRequest.extraFilters,
      technical: filteredRequest.technical
    };

    newChargingStationTemplate.id = await ChargingStationTemplateStorage.saveChargingStationTemplate(newChargingStationTemplate);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateChargingStationTemplate',
      message: `'${newChargingStationTemplate.id}' has been updated successfully`,
      action: action,
      detailedMessages: { chargingStationtemplate: newChargingStationTemplate }
    });
    res.json(Object.assign({ id: newChargingStationTemplate.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }
}
