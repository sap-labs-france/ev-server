import { Action, Entity } from '../../../../types/Authorization';
import { BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingUserSynchronizeAction } from '../../../../types/Billing';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import BillingSecurity from './security/BillingSecurity';
import { BillingSettings } from '../../../../types/Setting';
import BillingStorage from '../../../../storage/mongodb/BillingStorage';
import BillingValidator from '../validator/BillingValidator';
import Constants from '../../../../utils/Constants';
import { DataResult } from '../../../../types/DataResult';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'BillingService';

export default class BillingService {

  public static async handleClearBillingTestData(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.CLEAR_BILLING_TEST_DATA, Entity.BILLING, MODULE_NAME, 'handleClearBillingTestData');
    if (!await Authorizations.canClearBillingTestData(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.BILLING, action: Action.CLEAR_BILLING_TEST_DATA,
        module: MODULE_NAME, method: 'handleClearBillingTestData',
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleClearBillingTestData',
        action: action,
        user: req.user
      });
    }
    try {
      // Check Prerequisites
      await billingImpl.checkTestDataCleanupPrerequisites();
      // Clear the test data
      await billingImpl.clearTestData();
      // Reset billing settings
      const newSettings = await billingImpl.resetConnectionSettings();
      const operationResult: BillingOperationResult = {
        succeeded: true,
        internalData: newSettings
      };
      res.json(operationResult);
    } catch (error) {
      // Ko
      await Logging.logError({
        tenantID: req.user.tenantID,
        user: req.user,
        module: MODULE_NAME, method: 'handleClearBillingTestData',
        message: 'Failed to clear billing test data',
        action: action,
        detailedMessages: { error: error.stack }
      });
      const operationResult: BillingOperationResult = {
        succeeded: false,
        error
      };
      res.json(operationResult);
    }
    next();
  }

  public static async handleCheckBillingConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.CHECK_CONNECTION, Entity.BILLING, MODULE_NAME, 'handleCheckBillingConnection');
    if (!await Authorizations.canCheckBillingConnection(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.BILLING, action: Action.CHECK_CONNECTION,
        module: MODULE_NAME, method: 'handleCheckBillingConnection',
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleCheckBillingConnection',
        action: action,
        user: req.user
      });
    }
    try {
      await billingImpl.checkConnection();
      res.json(Object.assign({ connectionIsValid: true }, Constants.REST_RESPONSE_SUCCESS));
    } catch (error) {
      // Ko
      await Logging.logError({
        tenantID: req.user.tenantID,
        user: req.user,
        module: MODULE_NAME, method: 'handleCheckBillingConnection',
        message: 'Billing connection failed',
        action: action,
        detailedMessages: { error: error.stack }
      });
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleSynchronizeUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!(await Authorizations.canSynchronizeUsersBilling(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USERS,
        module: MODULE_NAME, method: 'handleSynchronizeUsers',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_BILLING_USERS, Entity.USER, MODULE_NAME, 'handleSynchronizeUsers');
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeUsers',
        action: action,
        user: req.user
      });
    }
    // Get the lock
    let synchronizeAction: BillingUserSynchronizeAction = {
      inError: 0,
      inSuccess: 0,
    };
    const billingLock = await LockingHelper.acquireBillingSyncUsersLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync users
        synchronizeAction = await billingImpl.synchronizeUsers();
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot acquire lock',
        module: MODULE_NAME, method: 'handleSynchronizeUsers',
        action: action,
        user: req.user
      });
    }
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleSynchronizeUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    if (!(await Authorizations.canSynchronizeUserBilling(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER,
        module: MODULE_NAME, method: 'handleSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_BILLING_USERS, Entity.USER, MODULE_NAME, 'handleSynchronizeUser');
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Get user
    const userToSynchronize = await UserStorage.getUser(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, userToSynchronize, `User ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSynchronizeUser', req.user);
    // Get the lock
    const billingLock = await LockingHelper.acquireBillingSyncUsersLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync user
        await billingImpl.synchronizeUser(userToSynchronize);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot acquire lock',
        module: MODULE_NAME, method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleForceSynchronizeUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    if (!(await Authorizations.canSynchronizeUserBilling(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER,
        module: MODULE_NAME, method: 'handleForceSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_BILLING_USER, Entity.USER, MODULE_NAME, 'handleForceSynchronizeUser');
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleForceSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Get user
    const user = await UserStorage.getUser(req.tenant, filteredRequest.id);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSynchronizeUser', req.user);
    // Get the User lock
    const billingLock = await LockingHelper.acquireBillingSyncUsersLock(req.user.tenantID);
    if (billingLock) {
      try {
        await billingImpl.forceSynchronizeUser(user);
      } finally {
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot acquire lock',
        module: MODULE_NAME, method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetBillingTaxes(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!await Authorizations.canReadTaxesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.TAX, action: Action.LIST,
        module: MODULE_NAME, method: 'handleGetBillingTaxes',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.TAX, MODULE_NAME, 'handleGetBillingTaxes');
    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleGetBillingTaxes',
        action: action,
        user: req.user
      });
    }
    // Get taxes
    const taxes = await billingImpl.getTaxes();
    res.json(taxes);
    next();
  }

  public static async handleGetInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.INVOICE, MODULE_NAME, 'handleGetInvoices');
    if (!await Authorizations.canListInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.INVOICE, action: Action.LIST,
        module: MODULE_NAME, method: 'handleGetInvoices',
      });
    }
    // Check Users
    let userProject: string[] = [];
    // Temporary fix before new auth migration
    if (!Authorizations.isDemo(req.user)) {
      userProject = [ 'userID', 'user.id', 'user.name', 'user.firstName', 'user.email' ];
    }
    // Filter
    const filteredRequest = BillingValidator.getInstance().validateBillingInvoicesGetReq(req.query);
    // Get invoices
    const invoices = await BillingStorage.getInvoices(req.tenant,
      {
        userIDs: !Authorizations.isAdmin(req.user) ? [req.user.id] : (filteredRequest.UserID ? filteredRequest.UserID.split('|') : null),
        invoiceStatus: filteredRequest.Status ? filteredRequest.Status.split('|') as BillingInvoiceStatus[] : null,
        search: filteredRequest.Search ? filteredRequest.Search : null,
        startDateTime: filteredRequest.StartDateTime ? filteredRequest.StartDateTime : null,
        endDateTime: filteredRequest.EndDateTime ? filteredRequest.EndDateTime : null,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [
        'id', 'number', 'status', 'amount', 'createdOn', 'currency', 'downloadable', 'sessions',
        ...userProject
      ]);
    res.json(invoices);
    next();
  }

  public static async handleGetInvoice(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.INVOICE, MODULE_NAME, 'handleGetInvoice');
    // Filter
    const filteredRequest = BillingValidator.getInstance().validateBillingInvoiceReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetInvoice', req.user);
    // Check Users
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = [ 'userID', 'user.id', 'user.name', 'user.firstName', 'user.email' ];
    }
    // Get invoice
    const invoice = await BillingStorage.getInvoice(req.tenant, filteredRequest.ID,
      [
        'id', 'number', 'status', 'amount', 'createdOn', 'currency', 'downloadable', 'sessions',
        ...userProject
      ]);
    UtilsService.assertObjectExists(action, invoice, `Invoice ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleGetInvoice', req.user);
    // Check auth
    if (!await Authorizations.canReadInvoiceBilling(req.user, invoice.userID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.INVOICE, action: Action.READ,
        module: MODULE_NAME, method: 'handleGetInvoice',
      });
    }
    res.json(invoice);
    next();
  }

  public static async handleSynchronizeInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!await Authorizations.canSynchronizeInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.INVOICE, action: Action.SYNCHRONIZE,
        module: MODULE_NAME, method: 'handleSynchronizeInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE, Entity.INVOICE, MODULE_NAME, 'handleSynchronizeInvoices');
    // Check user
    let user: User;
    if (!Authorizations.isAdmin(req.user)) {
      // Get the User
      user = await UserStorage.getUser(req.tenant, req.user.id);
      UtilsService.assertObjectExists(action, user, `User ID '${req.user.id}' does not exist`,
        MODULE_NAME, 'handleSynchronizeUserInvoices', req.user);
    }
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeInvoices',
        action: action,
        user: req.user
      });
    }
    let synchronizeAction: BillingUserSynchronizeAction = {
      inError: 0,
      inSuccess: 0,
    };
    // Get the Invoice lock
    const billingLock = await LockingHelper.acquireBillingSyncInvoicesLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync invoices
        synchronizeAction = await billingImpl.synchronizeInvoices(user);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot acquire lock',
        module: MODULE_NAME, method: 'handleSynchronizeUserInvoices',
        action: action,
        user: req.user
      });
    }
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleForceSynchronizeUserInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!await Authorizations.canSynchronizeInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.INVOICE, action: Action.SYNCHRONIZE,
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE, Entity.INVOICE, MODULE_NAME, 'handleForceSynchronizeUserInvoices');
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
        action: action,
        user: req.user
      });
    }
    const filteredRequest = BillingSecurity.filterForceSynchronizeUserInvoicesRequest(req.body);
    // Get the User
    const user = await UserStorage.getUser(req.tenant, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleForceSynchronizeUserInvoices', req.user);
    // Get the Invoice lock
    let synchronizeAction: BillingUserSynchronizeAction = {
      inError: 0,
      inSuccess: 0,
    };
    const billingLock = await LockingHelper.acquireBillingSyncInvoicesLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync invoices
        synchronizeAction = await billingImpl.synchronizeInvoices(user);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot acquire lock',
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
        action: action,
        user: req.user
      });
    }
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleBillingSetupPaymentMethod(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_SETUP_PAYMENT_METHOD, Entity.BILLING, MODULE_NAME, 'handleSetupSetupPaymentMethod');
    // Filter
    const filteredRequest = BillingValidator.getInstance().validateBillingSetupUserPaymentMethodReq(req.body);
    if (!await Authorizations.canCreatePaymentMethod(req.user, filteredRequest.userID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.PAYMENT_METHOD,
        module: MODULE_NAME, method: 'handleBillingSetupPaymentMethod'
      });
    }
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleBillingSetupPaymentMethod',
        action: action,
        user: req.user
      });
    }
    // Get user - ACHTUNG user !== req.user
    const user: User = await UserStorage.getUser(req.tenant, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleSetupPaymentMethod', req.user);
    // Invoke the billing implementation
    const paymentMethodId: string = filteredRequest.paymentMethodId;
    const operationResult: BillingOperationResult = await billingImpl.setupPaymentMethod(user, paymentMethodId);
    if (operationResult) {
      Utils.isDevelopmentEnv() && Logging.logConsoleError(operationResult as unknown as string);
    }
    res.json(operationResult);
    next();
  }

  public static async handleBillingGetPaymentMethods(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = BillingValidator.getInstance().validateBillingGetUserPaymentMethodsReq(req.query);
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_PAYMENT_METHODS, Entity.BILLING, MODULE_NAME, 'handleBillingGetPaymentMethods');
    if (!await Authorizations.canListPaymentMethod(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.PAYMENT_METHOD,
        module: MODULE_NAME, method: 'handleBillingGetPaymentMethods'
      });
    }
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.MISSING_SETTINGS,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleBillingGetPaymentMethods',
        action: action,
        user: req.user
      });
    }
    // Get user - ACHTUNG user !== req.user
    const user: User = await UserStorage.getUser(req.tenant, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleBillingGetPaymentMethods', req.user);
    // Invoke the billing implementation
    const paymentMethods: BillingPaymentMethod[] = await billingImpl.getPaymentMethods(user);
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user,
      action: ServerAction.BILLING_PAYMENT_METHODS,
      module: MODULE_NAME, method: 'getPaymentMethods',
      message: `Number of payment methods: ${paymentMethods?.length}`
    });
    const dataResult: DataResult<BillingPaymentMethod> = {
      count: paymentMethods.length,
      result: paymentMethods
    };
    res.json(dataResult);
    next();
  }

  public static async handleBillingDeletePaymentMethod(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = BillingValidator.getInstance().validateBillingDeleteUserPaymentMethodReq(req.body);
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_PAYMENT_METHODS, Entity.BILLING, MODULE_NAME, 'handleBillingDeletePaymentMethod');
    if (!await Authorizations.canDeletePaymentMethod(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.PAYMENT_METHOD,
        module: MODULE_NAME, method: 'handleBillingDeletePaymentMethod'
      });
    }
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleBillingDeletePaymentMethod',
        action: action,
        user: req.user
      });
    }
    const userID = filteredRequest.userID;
    const user: User = await UserStorage.getUser(req.tenant, userID);
    UtilsService.assertObjectExists(action, user, `User ID '${userID}' does not exist`,
      MODULE_NAME, 'handleBillingDeletePaymentMethod', req.user);
    // Invoke the billing implementation
    const operationResult: BillingOperationResult = await billingImpl.deletePaymentMethod(user, filteredRequest.paymentMethodId);
    // Log
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteSite',
      message: `Payment Method '${filteredRequest.paymentMethodId}' has been deleted successfully`,
      action: action
    });
    res.json(operationResult);
    next();
  }

  public static async handleDownloadInvoice(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.DOWNLOAD, Entity.BILLING, MODULE_NAME, 'handleDownloadInvoice');
    // Filter
    const filteredRequest = BillingValidator.getInstance().validateBillingInvoiceReq(req.query);
    // Get the Invoice
    const billingInvoice = await BillingStorage.getInvoice(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, billingInvoice, `Invoice ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDownloadInvoice', req.user);
    // Check Auth
    if (!await Authorizations.canDownloadInvoiceBilling(req.user, billingInvoice.userID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.INVOICE, action: Action.DOWNLOAD,
        module: MODULE_NAME, method: 'handleDownloadInvoice',
      });
    }
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleDownloadInvoice',
        action: action,
        user: req.user
      });
    }

    const buffer = await billingImpl.downloadInvoiceDocument(billingInvoice);
    if (!billingInvoice.number || !buffer) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Invoice document not found',
        module: MODULE_NAME, method: 'handleDownloadInvoice',
        action: action,
        user: req.user
      });
    }
    const fileName = 'invoice_' + billingInvoice.number + '.pdf';
    res.attachment(fileName);
    res.setHeader('Content-Type', 'application/pdf');
    res.end(buffer, 'binary');
  }

  public static async handleGetBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.READ, Entity.SETTING, MODULE_NAME, 'handleGetBillingSetting');
    // Check auth
    if (!await Authorizations.canReadBillingSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleGetBillingSetting',
      });
    }
    const billingSettings: BillingSettings = await SettingStorage.getBillingSetting(req.tenant);
    UtilsService.assertObjectExists(action, billingSettings, 'Failed to load billing settings', MODULE_NAME, 'handleGetBillingSetting', req.user);
    UtilsService.hashSensitiveData(req.user.tenantID, billingSettings);
    res.json(billingSettings);
    next();
  }

  public static async handleUpdateBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.UPDATE, Entity.SETTING, MODULE_NAME, 'handleUpdateBillingSetting');
    // Check auth
    if (!await Authorizations.canUpdateBillingSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SETTING,
        module: MODULE_NAME, method: 'handleUpdateBillingSetting',
      });
    }
    const newBillingProperties = BillingValidator.getInstance().validateBillingSettingUpdateReq({ ...req.params, ...req.body });
    // Load previous settings
    const billingSettings = await SettingStorage.getBillingSetting(req.tenant);
    UtilsService.assertObjectExists(action, billingSettings, 'Failed to load billing settings', MODULE_NAME, 'handleUpdateBillingSetting', req.user);
    await UtilsService.processSensitiveData(req.tenant, billingSettings, newBillingProperties);
    // Billing properties to preserve
    const { usersLastSynchronizedOn } = billingSettings.billing;
    const previousTransactionBillingState = !!billingSettings.billing.isTransactionBillingActivated;
    // Billing properties to override
    const { immediateBillingAllowed, periodicBillingAllowed, taxID } = newBillingProperties.billing;
    const newTransactionBillingState = !!newBillingProperties.billing.isTransactionBillingActivated;
    if (!newTransactionBillingState && previousTransactionBillingState) {
      // Attempt to switch it OFF
      throw new AppError({
        errorCode: StatusCodes.METHOD_NOT_ALLOWED,
        message: 'Switching OFF the billing of transactions is forbidden',
        module: MODULE_NAME,
        method: 'handleUpdateBillingSetting'
      });
    }
    // -----------------------------------------------------------
    // ACHTUNG - Handle with care the activation of the billing
    // -----------------------------------------------------------
    let postponeTransactionBillingActivation = false;
    let isTransactionBillingActivated: boolean;
    if (newTransactionBillingState && !previousTransactionBillingState) {
      // --------------------------------------------------------------------------
      // Attempt to switch it ON
      // - We need to postpone the activation in order to check the prerequisites
      // - Prerequisites cannot be checked without first saving all other settings
      // ---------------------------------------------------------------------------
      isTransactionBillingActivated = false ;
      postponeTransactionBillingActivation = true;
    } else {
      // Let's preserve the previous state
      isTransactionBillingActivated = previousTransactionBillingState;
    }
    // Now populates the settings with the new values
    billingSettings.billing = {
      isTransactionBillingActivated,
      usersLastSynchronizedOn,
      immediateBillingAllowed,
      periodicBillingAllowed,
      taxID,
    };
    // Make sure to preserve critical connection properties
    let readOnlyProperties = {};
    if (previousTransactionBillingState) {
      readOnlyProperties = {
        // STRIPE keys cannot be changed when Billing was already in a PRODUCTIVE mode
        publicKey: billingSettings.stripe.publicKey,
        secretKey: billingSettings.stripe.secretKey,
      };
    }
    billingSettings.stripe = {
      ...newBillingProperties.stripe,
      ...readOnlyProperties
    };
    // Update timestamp
    billingSettings.lastChangedBy = { 'id': req.user.id };
    billingSettings.lastChangedOn = new Date();
    // Let's save the new settings
    await SettingStorage.saveBillingSetting(req.tenant, billingSettings);
    // Post-process the activation of the billing feature
    if (postponeTransactionBillingActivation) {
      await BillingService.checkActivationPrerequisites(action, req);
      // Well - everything was Ok, activation is possible
      billingSettings.billing.isTransactionBillingActivated = true;
      // Save it again now that we are sure
      await SettingStorage.saveBillingSetting(req.tenant, billingSettings);
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async checkActivationPrerequisites(action: ServerAction, req: Request) : Promise<void> {
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'checkActivationPrerequisites',
        action: action,
        user: req.user
      });
    }
    // Check the connection
    await billingImpl.checkConnection();
    // Let's validate the new settings before activating
    await billingImpl.checkActivationPrerequisites();
  }
}
