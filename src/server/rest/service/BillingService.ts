import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import BillingFactory from '../../../integration/billing/BillingFactory';
import BillingSecurity from './security/BillingSecurity';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';


export default class BillingService {

  public static async handleGetBillingConnection(action: Action, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canCheckConnectionBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.CHECK_CONNECTION_BILLING,
        module: 'BillingService', method: 'handleGetBillingConnection',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
      !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService', method: 'handleSynchronizeUsers',
        action: action,
        user: req.user
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleGetBillingConnection',
        action: action,
        user: req.user
      });
    }
    if (!Authorizations.canCheckConnectionBilling(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot connect to the billing service, check your configuration',
        module: 'BillingService', method: 'handleGetBillingConnection',
        action: action,
        user: req.user
      });
    }
    try {
      // Check
      await billingImpl.checkConnection();
      // Ok
      res.json(Object.assign({ connectionIsValid: true }, Constants.REST_RESPONSE_SUCCESS));
    } catch (error) {
      // Ko
      Logging.logError({
        tenantID: tenant.id,
        user: req.user,
        module: 'BillingService', method: 'handleGetBillingConnection',
        message: 'Billing connection failed',
        action: action,
        detailedMessages: error
      });
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleSynchronizeUsers(action: Action, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canSynchronizeUsersBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
      !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService',
        method: 'handleSynchronizeUsers',
        action: Action.SYNCHRONIZE_BILLING,
        user: req.user
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleGetBillingConnection',
        action: action,
        user: req.user
      });
    }
    // Sync users
    const synchronizeAction = await billingImpl.synchronizeUsers(tenant.id);
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleSynchronizeUser(action: Action, req: Request, res: Response, next: NextFunction) {
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body.user);
    if (!Authorizations.canSynchronizeUserBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUser',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
        !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService', method: 'handleSynchronizeUser',
        action: Action.SYNCHRONIZE_BILLING,
        user: req.user
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleGetBillingConnection',
        action: action,
        user: req.user
      });
    }
    // Get user
    const userToSynchronize = await UserStorage.getUserByEmail(filteredRequest.email, tenant.id);
    // Sync user
    const synchronizeAction = await billingImpl.synchronizeUser(userToSynchronize, tenant.id);
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleForceSynchronizeUser(action: Action, req: Request, res: Response, next: NextFunction) {
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    if (!Authorizations.canForceUserSynchronizationBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleForceSynchronizeUser',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
        !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService', method: 'handleForceSynchronizeUser',
        action: Action.SYNCHRONIZE_BILLING,
        user: req.user
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleGetBillingConnection',
        action: action,
        user: req.user
      });
    }
    // Get user
    const userToSynchronize = await UserStorage.getUser(tenant.id, filteredRequest.id);
    // Sync user
    const synchronizeAction = await billingImpl.forceUserSynchronization(userToSynchronize, tenant.id);
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleGetBillingTaxes(action: Action, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canReadBillingTaxes(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.READ_BILLING_TAXES,
        module: 'BillingService', method: 'handleGetBillingTaxes',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.BILLING) ||
        !Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.PRICING)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing or Pricing not active in this Tenant',
        module: 'BillingService', method: 'handleSynchronizeUsers',
        action: action,
        user: req.user
      });
    }
    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleGetBillingTaxes',
        action: action,
        user: req.user
      });
    }
    // Get taxes
    let taxes = await billingImpl.getTaxes();
    // Return
    taxes = BillingSecurity.filterTaxesResponse(taxes, req.user);
    res.json(Object.assign(taxes, Constants.REST_RESPONSE_SUCCESS));
  }
}
