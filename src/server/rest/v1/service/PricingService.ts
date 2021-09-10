import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { PricingDataResult } from '../../../../types/DataResult';
import PricingDefinition from '../../../../types/Pricing';
import PricingSecurity from './security/PricingSecurity';
import PricingStorage from '../../../../storage/mongodb/PricingStorage';
import { ServerAction } from '../../../../types/Server';
import { TenantComponents } from '../../../../types/Tenant';
import UtilsService from './UtilsService';

const MODULE_NAME = 'PricingService';

export default class PricingService {

  public static async handleDeletePricingDefinition(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.DELETE, Entity.COMPANY, MODULE_NAME, 'handleDeletePricingDefinition');
    // Filter
    const pricingModelID = PricingSecurity.filterPricingDefinitionRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, pricingModelID, MODULE_NAME, 'handleDeletePricingDefinition', req.user);
    // Check and Get Pricing
    const pricing = await UtilsService.checkAndGetPricingDefinitionAuthorization(
      req.tenant, req.user, pricingModelID, Action.DELETE, action);
    // Delete
    await PricingStorage.deletePricingDefinition(req.tenant, pricing.id);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeletePricingDefinition',
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      message: `Pricing model '${pricingModelID}' has been deleted successfully`,
      action: action,
      detailedMessages: { pricing }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetPricingDefinition(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.READ, Entity.COMPANY, MODULE_NAME, 'handleGetPricingDefinition');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingDefinitionRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetPricingDefinition', req.user);
    // Check and Get Pricing
    const pricing = await UtilsService.checkAndGetPricingDefinitionAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withLogo: true
      }, true);
    res.json(pricing);
    next();
  }

  public static async handleGetPricingDefinitions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.LIST, Entity.PRICING_DEFINITIONS, MODULE_NAME, 'handleGetPricingDefinitions');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingDefinitionsRequest(req.query);
    // Check dynamic auth
    const authorizationPricingDefinitionsFilter = await AuthorizationService.checkAndGetPricingDefinitionsAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationPricingDefinitionsFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the companies
    const pricingDefinitions = await PricingStorage.getPricingDefinitions(req.tenant,
      {
        // search: filteredRequest.Search,
        ...authorizationPricingDefinitionsFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationPricingDefinitionsFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addPricingDefinitionsAuthorizations(req.tenant, req.user, pricingDefinitions as PricingDataResult, authorizationPricingDefinitionsFilter);
    // Return
    res.json(pricingDefinitions);
    next();
  }

  public static async handleCreatePricingDefinition(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreatePricingDefinition');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingDefinitionCreateRequest(req.body);
    // Check
    UtilsService.checkIfPricingDefinitionValid(filteredRequest, req);
    // Get dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetPricingDefinitionAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest as PricingDefinition);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleCreatePricingDefinition'
      });
    }
    // Create pricing
    const newPricingDefinition: PricingDefinition = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as PricingDefinition;
    // Save
    newPricingDefinition.id = await PricingStorage.savePricingDefinition(req.tenant, newPricingDefinition);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreatePricingDefinition',
      message: `Pricing model '${newPricingDefinition.id}' has been created successfully`,
      action: action,
      detailedMessages: { pricingDefinition: newPricingDefinition }
    });
    // Ok
    res.json(Object.assign({ id: newPricingDefinition.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdatePricingDefinition(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.PRICING,
      Action.UPDATE, Entity.COMPANY, MODULE_NAME, 'handleUpdatePricingDefinition');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingDefinitionUpdateRequest(req.body);
    // Check Mandatory fields
    UtilsService.checkIfPricingDefinitionValid(filteredRequest, req);
    // Check and Get Pricing
    const pricingDefinition = await UtilsService.checkAndGetPricingDefinitionAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest as PricingDefinition);
    // Update
    pricingDefinition.entityID = filteredRequest.entityID;
    pricingDefinition.entityType = filteredRequest.entityType;
    pricingDefinition.name = filteredRequest.name;
    pricingDefinition.description = filteredRequest.description;
    pricingDefinition.staticRestrictions = filteredRequest.staticRestrictions;
    pricingDefinition.restrictions = filteredRequest.restrictions;
    pricingDefinition.dimensions = filteredRequest.dimensions;
    pricingDefinition.lastChangedBy = { 'id': req.user.id };
    pricingDefinition.lastChangedOn = new Date();
    // Update Pricing
    await PricingStorage.savePricingDefinition(req.tenant, pricingDefinition);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdatePricingDefinition',
      message: `Pricing model '${pricingDefinition.id}' has been updated successfully`,
      action: action,
      detailedMessages: { pricingDefinition }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
