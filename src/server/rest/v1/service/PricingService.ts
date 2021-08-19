import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { PricingDataResult } from '../../../../types/DataResult';
import PricingModel from '../../../../types/Pricing';
import PricingSecurity from './security/PricingSecurity';
import PricingStorage from '../../../../storage/mongodb/PricingStorage';
import { ServerAction } from '../../../../types/Server';
import TenantComponents from '../../../../types/TenantComponents';
import UtilsService from './UtilsService';

const MODULE_NAME = 'PricingService';

export default class PricingService {

  public static async handleDeletePricingModel(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.DELETE, Entity.COMPANY, MODULE_NAME, 'handleDeletePricingModel');
    // Filter
    const pricingModelID = PricingSecurity.filterPricingModelRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, pricingModelID, MODULE_NAME, 'handleDeletePricingModel', req.user);
    // Check and Get Pricing
    const pricing = await UtilsService.checkAndGetPricingModelAuthorization(
      req.tenant, req.user, pricingModelID, Action.DELETE, action);
    // Delete
    await PricingStorage.deletePricingModel(req.tenant, pricing.id);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeletePricingModel',
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      message: `Pricing model '${pricingModelID}' has been deleted successfully`,
      action: action,
      detailedMessages: { pricing }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetPricingModel(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.READ, Entity.COMPANY, MODULE_NAME, 'handleGetPricingModel');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingModelRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetPricingModel', req.user);
    // Check and Get Pricing
    const pricing = await UtilsService.checkAndGetPricingModelAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withLogo: true
      }, true);
    res.json(pricing);
    next();
  }

  public static async handleGetPricingModels(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.LIST, Entity.PRICING_MODELS, MODULE_NAME, 'handleGetPricingModels');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingModelsRequest(req.query);
    // Check dynamic auth
    const authorizationPricingModelsFilter = await AuthorizationService.checkAndGetPricingModelsAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationPricingModelsFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the companies
    const pricingModels = await PricingStorage.getPricingModels(req.tenant,
      {
        // search: filteredRequest.Search,
        ...authorizationPricingModelsFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationPricingModelsFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addPricingModelsAuthorizations(req.tenant, req.user, pricingModels as PricingDataResult, authorizationPricingModelsFilter);
    // Return
    res.json(pricingModels);
    next();
  }

  public static async handleCreatePricingModel(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreatePricingModel');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingModelCreateRequest(req.body);
    // Check
    UtilsService.checkIfPricingModelValid(filteredRequest, req);
    // Get dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetPricingModelAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest as PricingModel);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleCreatePricingModel'
      });
    }
    // Create pricing
    const newPricingModel: PricingModel = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as PricingModel;
    // Save
    newPricingModel.id = await PricingStorage.savePricingModel(req.tenant, newPricingModel);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreatePricingModel',
      message: `Pricing model '${newPricingModel.id}' has been created successfully`,
      action: action,
      detailedMessages: { pricingModel: newPricingModel }
    });
    // Ok
    res.json(Object.assign({ id: newPricingModel.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdatePricingModel(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.UPDATE, Entity.COMPANY, MODULE_NAME, 'handleUpdatePricingModel');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingModelUpdateRequest(req.body);
    // Check Mandatory fields
    UtilsService.checkIfPricingModelValid(filteredRequest, req);
    // Check and Get Pricing
    const pricingModel = await UtilsService.checkAndGetPricingModelAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest as PricingModel);
    // Update
    pricingModel.contextID = filteredRequest.contextID;
    pricingModel.pricingDefinitions = filteredRequest.pricingDefinitions;
    pricingModel.lastChangedBy = { 'id': req.user.id };
    pricingModel.lastChangedOn = new Date();
    // Update Pricing
    await PricingStorage.savePricingModel(req.tenant, pricingModel);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdatePricingModel',
      message: `Pricing model '${pricingModel.id}' has been updated successfully`,
      action: action,
      detailedMessages: { pricingModel: pricingModel }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
