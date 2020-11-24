import { Action, Entity } from '../../../../types/Authorization';
import { BillingInvoiceStatus, BillingUserSynchronizeAction } from '../../../../types/Billing';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import BillingSecurity from './security/BillingSecurity';
import BillingStorage from '../../../../storage/mongodb/BillingStorage';
import Constants from '../../../../utils/Constants';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import TenantComponents from '../../../../types/TenantComponents';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import fs from 'fs';

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
        entity: Entity.USERS, action: Action.SYNCHRONIZE_BILLING_USERS,
        module: MODULE_NAME, method: 'handleSynchronizeUsers',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_BILLING_USERS, Entity.USERS, MODULE_NAME, 'handleSynchronizeUsers');
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
        message: 'Cannot aquire lock',
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
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER,
        module: MODULE_NAME, method: 'handleSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_BILLING_USERS, Entity.USER, MODULE_NAME, 'handleSynchronizeUser');
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
        message: 'Cannot aquire lock',
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
        entity: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER,
        module: MODULE_NAME, method: 'handleForceSynchronizeUser',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_BILLING_USER, Entity.USER, MODULE_NAME, 'handleForceSynchronizeUser');
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
        message: 'Cannot aquire lock',
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
        message: 'Cannot aquire lock',
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
    // Return
    res.json(taxes);
    next();
  }

  public static async handleGetInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.INVOICES, MODULE_NAME, 'handleGetInvoices');
    if (!Authorizations.canListInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICES, action: Action.LIST,
        module: MODULE_NAME, method: 'handleGetInvoices',
      });
    }
    // Check Users
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'userID', 'user.id', 'user.name', 'user.firstName', 'user.email' ];
    }
    // Filter
    const filteredRequest = BillingSecurity.filterGetUserInvoicesRequest(req.query);
    // Get invoices
    const invoices = await BillingStorage.getInvoices(req.user.tenantID,
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
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [
        'id', 'number', 'status', 'amount', 'createdOn', 'nbrOfItems', 'currency', 'downloadable',
        ...userProject
      ]);
    // Return
    res.json(invoices);
    next();
  }

  public static async handleSynchronizeInvoices(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canSynchronizeInvoicesBilling(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICES, action: Action.SYNCHRONIZE,
        module: MODULE_NAME, method: 'handleSynchronizeInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE, Entity.INVOICES, MODULE_NAME, 'handleSynchronizeInvoices');
    // Check user
    let user: User;
    if (!Authorizations.isAdmin(req.user)) {
      // Get the User
      user = await UserStorage.getUser(req.user.tenantID, req.user.id);
      UtilsService.assertObjectExists(action, user, `User '${req.user.id}' does not exist`,
        MODULE_NAME, 'handleSynchronizeUserInvoices', req.user);
    }
    // Get the billing impl
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
    let synchronizeAction: BillingUserSynchronizeAction = {
      inError: 0,
      inSuccess: 0,
    };
    // Get the Invoice lock
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
        message: 'Cannot aquire lock',
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
        entity: Entity.INVOICES, action: Action.SYNCHRONIZE,
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE, Entity.INVOICES, MODULE_NAME, 'handleForceSynchronizeUserInvoices');
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
        message: 'Cannot aquire lock',
        module: MODULE_NAME, method: 'handleForceSynchronizeUserInvoices',
        action: action,
        user: req.user
      });
    }
    // Ok
    res.json(Object.assign(synchronizeAction, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleCreateTransactionInvoice(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.CREATE, Entity.INVOICE, MODULE_NAME, 'handleCreateTransactionInvoice');
    // Check Auth
    if (!Authorizations.canCreateTransactionInvoice(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICE, action: Action.CREATE,
        module: MODULE_NAME, method: 'handleCreateTransactionInvoice',
      });
    }
    const filteredRequest = BillingSecurity.filterLinkTransactionToInvoiceRequest(req.body);
    // Get Billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.user.tenantID);
    if (!billingImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleCreateTransactionInvoice',
        action: action,
        user: req.user
      });
    }
    // Get the Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID,
      Utils.convertToInt(filteredRequest.transactionID));
    UtilsService.assertObjectExists(action, transaction, `Transaction '${filteredRequest.transactionID}' does not exist`,
      MODULE_NAME, 'handleCreateTransactionInvoice', req.user);
    // Create an invoice for the transaction
    const billingDataStop = await billingImpl.stopTransaction(transaction);
    // Update transaction
    transaction.billingData = {
      status: billingDataStop.status,
      invoiceID: billingDataStop.invoiceID,
      invoiceStatus: billingDataStop.invoiceStatus,
      invoiceItem: billingDataStop.invoiceItem,
      lastUpdate: new Date()
    };
    await TransactionStorage.saveTransaction(req.user.tenantID, transaction);
    // Ok
    Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: transaction.userID,
      module: MODULE_NAME, method: 'handleCreateTransactionInvoice',
      message: `Transaction ID '${transaction.id}' has been billed successfully`,
      action: action,
    });
    // Ok
    res.json(Object.assign(Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleDownloadInvoice(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.DOWNLOAD, Entity.BILLING, MODULE_NAME, 'handleDownloadInvoice');
    // Filter
    const filteredRequest = BillingSecurity.filterDownloadInvoiceRequest(req.query);
    // Get the Invoice
    const invoice = await BillingStorage.getInvoice(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, invoice, `Invoice ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDownloadInvoice', req.user);
    // Check Auth
    if (!Authorizations.canDownloadInvoiceBilling(req.user, invoice.userID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.INVOICE, action: Action.DOWNLOAD,
        module: MODULE_NAME, method: 'handleDownloadInvoice',
      });
    }
    // Get the billing impl
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
