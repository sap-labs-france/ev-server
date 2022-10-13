import { NextFunction, Request, Response } from 'express';

import { Action } from '../../../../types/Authorization';
import AuthorizationService from './AuthorizationService';
import { ChargingStationTemplate } from '../../../../types/ChargingStation';
import { ChargingStationTemplateDataResult } from '../../../../types/DataResult';
import ChargingStationTemplateStorage from '../../../../storage/mongodb/ChargingStationTemplateStorage';
import ChargingStationTemplateValidator from '../validator/ChargingStationTemplateValidatorRest';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ChargingStationTemplateService';

export default class ChargingStationTemplateService {
  public static async handleCreateChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateCreateReq(req.body);
    // Check dynamic auth
    await AuthorizationService.checkAndGetChargingStationTemplateAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    const newChargingStationTemplate: ChargingStationTemplate = {
      id: null,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      template : {
        chargePointVendor: filteredRequest.template.chargePointVendor,
        capabilities: filteredRequest.template.capabilities,
        ocppStandardParameters: filteredRequest.template.ocppStandardParameters,
        ocppVendorParameters: filteredRequest.template.ocppVendorParameters,
        extraFilters: filteredRequest.template.extraFilters,
        technical: filteredRequest.template.technical,
      }
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
    const authorizations = await AuthorizationService.checkAndGetChargingStationTemplatesAuthorizations(
      req.tenant, req.user, Action.LIST, filteredRequest);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the templates list
    const chargingStationTemplates = await ChargingStationTemplateStorage.getChargingStationTemplates(
      {
        withUser: filteredRequest.WithUser,
        search: filteredRequest.Search,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      chargingStationTemplates.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addChargingStationTemplatesAuthorizations(req.tenant, req.user, chargingStationTemplates as ChargingStationTemplateDataResult, authorizations);
    }
    res.json(chargingStationTemplates);
    next();
  }

  public static async handleGetChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateGetReq(req.query);
    // Check and get templates
    const chargingStationTemplate = await UtilsService.checkAndGetChargingStationTemplateAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {}, true);
    res.json(chargingStationTemplate);
    next();
  }

  public static async handleDeleteChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const chargingStationTemplateID = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateDeleteReq(req.query).ID;
    // Check and get template by id
    const chargingStationTemplate = await UtilsService.checkAndGetChargingStationTemplateAuthorization(req.tenant, req.user, chargingStationTemplateID, Action.DELETE, action);
    // Delete
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
    // Filter
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateUpdateReq(req.body);
    // Check and get template by id
    const chargingStationTemplate = await UtilsService.checkAndGetChargingStationTemplateAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest, { withUser: true });
    const template = filteredRequest.template;
    chargingStationTemplate.template = {
      chargePointVendor: template.chargePointVendor,
      extraFilters: template.extraFilters,
      technical: template.technical,
      capabilities: template.capabilities,
      ocppStandardParameters: template.ocppStandardParameters,
      ocppVendorParameters: template.ocppVendorParameters,
    };
    chargingStationTemplate.lastChangedBy = { id: req.user.id };
    chargingStationTemplate.lastChangedOn = new Date();
    // Save
    await ChargingStationTemplateStorage.saveChargingStationTemplate(chargingStationTemplate);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateChargingStationTemplate',
      message: `'${chargingStationTemplate.id}' has been updated successfully`,
      action, detailedMessages: { chargingStationtemplate: chargingStationTemplate }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
