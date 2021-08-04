import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import Pricing from '../../../../types/Pricing';
import { PricingDataResult } from '../../../../types/DataResult';
import PricingSecurity from './security/PricingSecurity';
import PricingStorage from '../../../../storage/mongodb/PricingStorage';
import { ServerAction } from '../../../../types/Server';
import TenantComponents from '../../../../types/TenantComponents';
import UtilsService from './UtilsService';

const MODULE_NAME = 'PricingService';

export default class PricingService {

  public static async handleDeletePricing(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.COMPANY, MODULE_NAME, 'handleDeletePricing');
    // Filter
    const pricingID = PricingSecurity.filterPricingRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, pricingID, MODULE_NAME, 'handleDeletePricing', req.user);
    // Check and Get Pricing
    const pricing = await UtilsService.checkAndGetPricingAuthorization(
      req.tenant, req.user, pricingID, Action.DELETE, action);
    // Delete
    await PricingStorage.deletePricing(req.tenant, pricing.id);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeletePricing',
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      message: `Pricing '${pricingID}' has been deleted successfully`,
      action: action,
      detailedMessages: { pricing }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetPricing(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.COMPANY, MODULE_NAME, 'handleGetPricing');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetPricing', req.user);
    // Check and Get Pricing
    const pricing = await UtilsService.checkAndGetPricingAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withLogo: true
      }, true);
    res.json(pricing);
    next();
  }

  public static async handleGetPricings(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.PRICINGS, MODULE_NAME, 'handleGetPricings');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingsRequest(req.query);
    // Check dynamic auth
    const authorizationPricingsFilter = await AuthorizationService.checkAndGetPricingsAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationPricingsFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the companies
    const pricings = await PricingStorage.getPricings(req.tenant,
      {
        // search: filteredRequest.Search,
        ...authorizationPricingsFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationPricingsFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addPricingsAuthorizations(req.tenant, req.user, pricings as PricingDataResult, authorizationPricingsFilter);
    // Return
    res.json(pricings);
    next();
  }

  public static async handleCreatePricing(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreatePricing');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingCreateRequest(req.body);
    // Check
    UtilsService.checkIfPricingValid(filteredRequest, req);
    // Get dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetPricingAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest as Pricing);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleCreatePricing'
      });
    }
    // Create pricing
    const newPricing: Pricing = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Pricing;
    // Save
    newPricing.id = await PricingStorage.savePricing(req.tenant, newPricing);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreatePricing',
      message: `Pricing '${newPricing.id}' has been created successfully`,
      action: action,
      detailedMessages: { pricing: newPricing }
    });
    // Ok
    res.json(Object.assign({ id: newPricing.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdatePricing(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.COMPANY, MODULE_NAME, 'handleUpdatePricing');
    // Filter
    const filteredRequest = PricingSecurity.filterPricingUpdateRequest(req.body);
    // Check Mandatory fields
    UtilsService.checkIfPricingValid(filteredRequest, req);
    // Check and Get Pricing
    const pricing = await UtilsService.checkAndGetPricingAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest as Pricing);
    // Update
    pricing.lastChangedBy = { 'id': req.user.id };
    pricing.lastChangedOn = new Date();
    // Update Pricing
    await PricingStorage.savePricing(req.tenant, pricing);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdatePricing',
      message: `Pricing '${pricing.id}' has been updated successfully`,
      action: action,
      detailedMessages: { pricing }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
