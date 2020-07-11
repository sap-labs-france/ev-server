import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import BillingStorage from '../../../storage/mongodb/BillingStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../types/Authorization';
import { BillingInvoiceStatus, BillingUserSynchronizeAction } from '../../../types/Billing';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import User from '../../../types/User';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import BillingSecurity from './security/BillingSecurity';
import UtilsService from './UtilsService';


const MODULE_NAME = 'BillingService';

export default class BillingService {

  public static async handleCheckBillingConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canCheckConnectionBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.BILLING, action: Action.CHECK_CONNECTION,
        module: MODULE_NAME, method: 'handleCheckBillingConnection',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.CHECK_CONNECTION, Entity.BILLING, MODULE_NAME, 'handleCheckBillingConnection');
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleCheckBillingConnection',
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
        tenantID: req.user.tenantID,
        user: req.user,
        module: MODULE_NAME, method: 'handleCheckBillingConnection',
        message: 'Billing connection failed',
        action: action,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleSynchronizeUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
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
    // Get the lock
    let synchronizeAction: BillingUserSynchronizeAction = {
      inError: 0,
      inSuccess: 0,
    };
    const billingLock = await LockingHelper.createBillingSyncUsersLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync users
        synchronizeAction = await billingImpl.synchronizeUsers(req.user.tenantID);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot aquire block',
        module: MODULE_NAME, method: 'handleSynchronizeUsers',
        action: action,
        user: req.user
      });
    }
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleSynchronizeUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
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
    const userToSynchronize = await UserStorage.getUser(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, userToSynchronize, `User '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSynchronizeUser', req.user);
    // Get the lock
    const billingLock = await LockingHelper.createBillingSyncUsersLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync user
        await billingImpl.synchronizeUser(req.user.tenantID, userToSynchronize);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot aquire block',
        module: MODULE_NAME, method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleForceSynchronizeUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
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
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, user, `User '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSynchronizeUser', req.user);
    // Get the User lock
    let billingLock = await LockingHelper.createBillingSyncUsersLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync user
        await billingImpl.forceSynchronizeUser(req.user.tenantID, user);
      } finally {
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot aquire block',
        module: MODULE_NAME, method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Get the Invoice lock
    billingLock = await LockingHelper.createBillingSyncInvoicesLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync invoices
        await billingImpl.synchronizeInvoices(req.user.tenantID, user);
      } finally {
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot aquire block',
        module: MODULE_NAME, method: 'handleSynchronizeUser',
        action: action,
        user: req.user
      });
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetBillingTaxes(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canReadTaxesBilling(req.user)) {
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
    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
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

  public static async handleGetUserInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.INVOICES, MODULE_NAME, 'handleGetUserInvoices');
    if (!Authorizations.canReadInvoicesBilling(req.user)) {
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
    UtilsService.assertObjectExists(action, billingUser, `Billing user with email '${req.user.email}' does not exist`,
      MODULE_NAME, 'handleGetUserInvoices', req.user);
    if (Authorizations.isBasic(req.user)) {
      filteredRequest.UserID = req.user.id;
    }
    // Get invoices
    const invoices = await BillingStorage.getInvoices(req.user.tenantID,
      {
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
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

  public static async handleSynchronizeInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
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
    // Check user
    let user: User;
    if (Authorizations.isBasic(req.user)) {
      // Get the User
      user = await UserStorage.getUser(req.user.tenantID, req.user.id);
      UtilsService.assertObjectExists(action, user, `User '${req.user.id}' does not exist`,
        MODULE_NAME, 'handleSynchronizeUserInvoices', req.user);
    }
    // Get the Invoice lock
    let synchronizeAction: BillingUserSynchronizeAction = {
      inError: 0,
      inSuccess: 0,
    };
    const billingLock = await LockingHelper.createBillingSyncInvoicesLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync invoices
        synchronizeAction = await billingImpl.synchronizeInvoices(req.user.tenantID, user);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot aquire block',
        module: MODULE_NAME, method: 'handleSynchronizeUserInvoices',
        action: action,
        user: req.user
      });
    }
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleForceSynchronizeUserInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canSynchronizeInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.USER, action: Action.SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_INVOICES, Entity.BILLING, MODULE_NAME, 'handleForceSynchronizeUserInvoices');
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
        action: action,
        user: req.user
      });
    }
    const filteredRequest = BillingSecurity.filterForceSynchronizeUserInvoicesRequest(req.body);
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleForceSynchronizeUserInvoices', req.user);
    // Get the Invoice lock
    let synchronizeAction: BillingUserSynchronizeAction = {
      inError: 0,
      inSuccess: 0,
    };
    const billingLock = await LockingHelper.createBillingSyncInvoicesLock(req.user.tenantID);
    if (billingLock) {
      try {
        // Sync invoices
        synchronizeAction = await billingImpl.synchronizeInvoices(req.user.tenantID, user);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    } else {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot aquire block',
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
        action: action,
        user: req.user
      });
    }
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDownloadInvoice(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.DOWNLOAD, Entity.BILLING, MODULE_NAME, 'handleDownloadInvoice');
    // Check Auth
    if (!Authorizations.canDownloadInvoiceBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICE, action: Action.DOWNLOAD,
        module: MODULE_NAME, method: 'handleDownloadInvoice',
      });
    }
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleDownloadInvoice',
        action: action,
        user: req.user
      });
    }
    const filteredRequest = BillingSecurity.filterDownloadInvoiceRequest(req.query);
    // Get the Invoice
    const invoice = await BillingStorage.getInvoice(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, invoice, `Invoice ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDownloadInvoice', req.user);
    // Check if belonging to the logged user
    if (!Authorizations.isAdmin(req.user) && invoice.userID.toString() !== req.user.id) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICE, action: Action.DOWNLOAD,
        module: MODULE_NAME, method: 'handleDownloadInvoice',
      });
    }
    // Get the Invoice Document
    const invoiceDocument = await BillingStorage.getInvoiceDocument(req.user.tenantID, invoice.id);
    UtilsService.assertObjectExists(action, invoiceDocument, `Invoice Document ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDownloadInvoice', req.user);
    // Send the Document
    if (invoiceDocument && invoiceDocument.content) {
      const base64RawData = invoiceDocument.content.split(`;${invoiceDocument.encoding},`).pop();
      const filename = 'invoice_' + invoice.id + '.' + invoiceDocument.type;
      fs.writeFile(filename, base64RawData, { encoding: invoiceDocument.encoding }, (err) => {
        if (err) {
          console.log(err);
          throw err;
        }
        res.download(filename, (err2) => {
          if (err2) {
            console.log(err2);
            throw err2;
          }
          fs.unlink(filename, (err3) => {
            if (err3) {
              console.log(err3);
              throw err3;
            }
          });
        });
      });
    }
  }
}
