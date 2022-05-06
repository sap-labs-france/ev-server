import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import { ChargingStationTemplate } from '../../../../types/ChargingStation';
import { ChargingStationTemplateDataResult } from '../../../../types/DataResult';
import ChargingStationTemplateStorage from '../../../../storage/mongodb/ChargingStationTemplateStorage';
import ChargingStationTemplateValidator from '../validator/ChargingStationTemplateValidator';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import { ServerAction } from '../../../../types/Server';
import UtilsService from './UtilsService';

const MODULE_NAME = 'ChargingStationTemplateService';

export default class ChargingStationTemplateService {
  public static async handleCreateChargingStationTemplate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // const filteredRequest = ChargingStationTemplateValidator.getInstance().validateCarCreateReq(req.body);
    const filteredRequest = req.body;
    await AuthorizationService.checkAndGetChargingStationTemplateAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest as ChargingStationTemplate);
    // Check auth
    if (!(await Authorizations.canCreateChargingStationTemplates(req.user))) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IMPORT, entity: Entity.CHARGING_STATION_TEMPLATE,
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

    newChargingStationTemplate.id = await ChargingStationTemplateStorage.saveChargingStationTemplate(req.tenant, newChargingStationTemplate);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      ...LoggingHelper.getChargingStationTemplateProperties(newChargingStationTemplate),
      user: req.user, module: MODULE_NAME, method: 'handleCreateChargingStationTemplate',
      message: `newChargingStationTemplate '${newChargingStationTemplate.id}' has been created successfully`,
      action: action,
      detailedMessages: { car: newChargingStationTemplate }
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
    const chargingStationTemplates = await ChargingStationTemplateStorage.getChargingStationTemplates(req.tenant,
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
    const filteredRequest = ChargingStationTemplateValidator.getInstance().validateChargingStationTemplateGetReq(req.query);
    // Check and Get Registration Token
    const chargingStationTemplate = await UtilsService.checkAndGetChargingStationTemplateAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {}, true);
    res.json(chargingStationTemplate);
    next();
  }
}

