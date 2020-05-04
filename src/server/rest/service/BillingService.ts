import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import BillingFactory from '../../../integration/billing/BillingFactory';
import { BillingInvoiceStatus } from '../../../types/Billing';
import BillingSecurity from './security/BillingSecurity';
import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import UtilsService from './UtilsService';

const MODULE_NAME = 'BillingService';

export default class BillingService {

  public static async handleCheckBillingConnection(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canCheckConnectionBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.BILLING, action: Action.CHECK_CONNECTION,
        module: MODULE_NAME, method: 'handleGetBillingConnection',
      });
    }
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.CHECK_CONNECTION, Entity.BILLING, MODULE_NAME, 'handleGetBillingConnection');
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleGetBillingConnection',
        action: action,
        user: req.user
      });
    }
    if (!Authorizations.canCheckConnectionBilling(req.user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot connect to the billing service, check your configuration',
        module: MODULE_NAME, method: 'handleGetBillingConnection',
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
        module: MODULE_NAME, method: 'handleGetBillingConnection',
        message: 'Billing connection failed',
        action: action,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleSynchronizeUsers(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canSynchronizeUsersBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USERS, action: Action.SYNCHRONIZE_USERS,
        module: MODULE_NAME, method: 'handleSynchronizeUsers',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_USERS, Entity.BILLING, MODULE_NAME, 'handleSynchronizeUsers');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeUsers',
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

  public static async handleSynchronizeUser(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    if (!Authorizations.canSynchronizeUserBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'handleSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_USERS, Entity.BILLING, MODULE_NAME, 'handleSynchronizeUser');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Get user
    const userToSynchronize = await UserStorage.getUser(tenant.id, filteredRequest.id);
    UtilsService.assertObjectExists(action, userToSynchronize, `User '${filteredRequest.id}' doesn't exist anymore.`,
      MODULE_NAME, 'handleSynchronizeUser', req.user);
    // Sync user
    await billingImpl.synchronizeUser(userToSynchronize, tenant.id);
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleForceSynchronizeUser(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    if (!Authorizations.canSynchronizeUserBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'handleForceSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_USER, Entity.BILLING, MODULE_NAME, 'handleForceSynchronizeUser');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleForceSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Get user
    const userToSynchronize = await UserStorage.getUser(tenant.id, filteredRequest.id);
    UtilsService.assertObjectExists(action, userToSynchronize, `User '${filteredRequest.id}' doesn't exist anymore.`,
      MODULE_NAME, 'handleSynchronizeUser', req.user);
    // Sync user
    await billingImpl.forceSynchronizeUser(userToSynchronize, tenant.id);
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetBillingTaxes(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canReadBillingTaxes(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.TAXES, action: Action.LIST,
        module: MODULE_NAME, method: 'handleGetBillingTaxes',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.TAXES, MODULE_NAME, 'handleGetBillingTaxes');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleGetBillingTaxes',
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

  public static async handleGetUserInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.INVOICES, MODULE_NAME, 'handleGetUserInvoices');
    if (!Authorizations.canReadBillingInvoices(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICES, action: Action.LIST,
        module: MODULE_NAME, method: 'handleGetUserInvoices',
      });
    }
    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleGetUserInvoices',
        action: action,
        user: req.user
      });
    }
    const filteredRequest = BillingSecurity.filterGetUserInvoicesRequest(req.query);
    // Get user
    const billingUser = await billingImpl.getUserByEmail(req.user.email);
    UtilsService.assertObjectExists(action, billingUser, `Billing user with email '${req.user.email}' doesn't exist anymore.`,
      MODULE_NAME, 'handleGetUserInvoices', req.user);
    if (Authorizations.isBasic(req.user)) {
      filteredRequest.UserID = req.user.id;
    }
    // Get invoices
    const invoices = await BillingStorage.getInvoices(req.user.tenantID,
      {
        userID: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        invoiceStatus: filteredRequest.Status ? filteredRequest.Status.split('|') as BillingInvoiceStatus[] : null,
        search: filteredRequest.Search ? filteredRequest.Search : null,
        startDateTime: filteredRequest.StartDateTime ? filteredRequest.StartDateTime : null,
        endDateTime: filteredRequest.EndDateTime ? filteredRequest.EndDateTime : null,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    // Filter
    BillingSecurity.filterInvoicesResponse(invoices, req.user);
    // Return
    res.json(invoices);
    next();
  }

  public static async handleSynchronizeInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canSynchronizeInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'handleSynchronizeInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_INVOICES, Entity.BILLING, MODULE_NAME, 'handleSynchronizeInvoices');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeInvoices',
        action: action,
        user: req.user
      });
    }
    // Sync invoices
    const synchronizeAction = await billingImpl.synchronizeInvoices(req.user.tenantID);
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleSynchronizeUserInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    if (!Authorizations.canSynchronizeInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'handleSynchronizeUserInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_INVOICES, Entity.BILLING, MODULE_NAME, 'handleSynchronizeUserInvoices');
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeInvoices',
        action: action,
        user: req.user
      });
    }
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, req.user.id);
    UtilsService.assertObjectExists(action, user, `User '${req.user.id}' doesn't exist anymore.`,
      MODULE_NAME, 'handleSynchronizeInvoices', req.user);
    // Sync user invoices
    const synchronizeAction = await billingImpl.synchronizeInvoices(req.user.tenantID, user);
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }
}
