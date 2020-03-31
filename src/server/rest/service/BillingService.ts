import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import BillingSecurity from './security/BillingSecurity';
import UtilsService from './UtilsService';


export default class BillingService {

  public static async handleGetBillingConnection(action: Action, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canCheckConnectionBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.BILLING, action: Action.BILLING_CHECK_CONNECTION,
        module: 'BillingService', method: 'handleGetBillingConnection',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_CHECK_CONNECTION, Entity.BILLING, 'BillingService', 'handleGetBillingConnection');
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
        detailedMessages: { error }
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
        entity: Entity.USERS, action: Action.BILLING_SYNCHRONIZE,
        module: 'BillingService', method: 'handleSynchronizeUsers',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_SYNCHRONIZE, Entity.BILLING, 'BillingService', 'handleSynchronizeUsers');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleSynchronizeUsers',
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
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    if (!Authorizations.canSynchronizeUserBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.BILLING_SYNCHRONIZE,
        module: 'BillingService', method: 'handleSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_SYNCHRONIZE, Entity.BILLING, 'BillingService', 'handleSynchronizeUser');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Get user
    const userToSynchronize = await UserStorage.getUser(tenant.id, filteredRequest.id);
    UtilsService.assertObjectExists(action, userToSynchronize, `User '${filteredRequest.id}' doesn't exist anymore.`,
      'BillingService', 'handleSynchronizeUser', req.user);
    // Sync user
    await billingImpl.synchronizeUser(userToSynchronize, tenant.id);
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleForceSynchronizeUser(action: Action, req: Request, res: Response, next: NextFunction) {
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    if (!Authorizations.canForceUserSynchronizationBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.BILLING_SYNCHRONIZE,
        module: 'BillingService', method: 'handleForceSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_FORCE_SYNCHRONIZE, Entity.BILLING, 'BillingService', 'handleForceSynchronizeUser');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleForceSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Get user
    const userToSynchronize = await UserStorage.getUser(tenant.id, filteredRequest.id);
    UtilsService.assertObjectExists(action, userToSynchronize, `User '${filteredRequest.id}' doesn't exist anymore.`,
      'BillingService', 'handleSynchronizeUser', req.user);
    // Sync user
    await billingImpl.forceSynchronizeUser(userToSynchronize, tenant.id);
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetBillingTaxes(action: Action, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canReadBillingTaxes(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.TAXES, action: Action.LIST,
        module: 'BillingService', method: 'handleGetBillingTaxes',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.TAXES, 'BillingService', 'handleGetBillingTaxes');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
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
    const taxes = await billingImpl.getTaxes();
    // Filter
    const filteredTaxes = BillingSecurity.filterTaxesResponse(taxes, req.user);
    // Return
    res.json(filteredTaxes);
    next();
  }

  public static async handleGetUserInvoices(action: Action, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canReadBillingInvoices(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICES, action: Action.LIST,
        module: 'BillingService', method: 'handleGetUserInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.INVOICES, 'BillingService', 'handleGetUserInvoices');
    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: 'BillingService', method: 'handleGetUserInvoices',
        action: action,
        user: req.user
      });
    }
    const filteredRequest = BillingSecurity.filterGetUserInvoicesRequest(req.query);
    const billingUser = await billingImpl.getUserByEmail(req.user.email);
    const invoices = await billingImpl.getUserInvoices(billingUser, {
      status: filteredRequest.status,
      startDateTime: filteredRequest.startDateTime,
      endDateTime: filteredRequest.endDateTime
    });
    invoices.result = BillingSecurity.filterInvoicesResponse(invoices.result, req.user);
    // Return
    res.json(Object.assign(invoices, Constants.REST_RESPONSE_SUCCESS));
    next();
  }
}
