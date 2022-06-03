import { Action, Entity } from '../../../../types/Authorization';
import { BillingInvoiceDataResult, BillingPaymentMethodDataResult } from '../../../../types/DataResult';
import { BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod } from '../../../../types/Billing';
import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import BillingSecurity from './security/BillingSecurity';
import { BillingSettings } from '../../../../types/Setting';
import BillingStorage from '../../../../storage/mongodb/BillingStorage';
import BillingValidatorRest from '../validator/BillingValidatorRest';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import NotificationHandler from '../../../../notification/NotificationHandler';
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
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING, Action.CLEAR_BILLING_TEST_DATA, Entity.BILLING, MODULE_NAME, 'handleClearBillingTestData');
    // Check dynamic auth
    await AuthorizationService.checkAndGetBillingAuthorizations(req.tenant, req.user, Action.CLEAR_BILLING_TEST_DATA);
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
        tenantID: req.tenant.id,
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
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING, Action.CHECK_CONNECTION, Entity.BILLING, MODULE_NAME, 'handleCheckBillingConnection');
    // Check dynamic authorization
    await AuthorizationService.checkAndGetBillingAuthorizations(req.tenant, req.user, Action.CHECK_CONNECTION);
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
        tenantID: req.tenant.id,
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

  public static async handleForceSynchronizeUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.SYNCHRONIZE_BILLING_USER, Entity.USER, MODULE_NAME, 'handleForceSynchronizeUser');
    // Filter
    const filteredRequest = BillingSecurity.filterSynchronizeUserRequest(req.body);
    // Check dynamic authorization
    await AuthorizationService.checkAndGetUserAuthorizations(req.tenant, req.user, {}, Action.SYNCHRONIZE_BILLING_USER);
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
    const billingLock = await LockingHelper.acquireBillingSyncUsersLock(req.tenant.id);
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
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING, Action.LIST, Entity.TAX, MODULE_NAME, 'handleGetBillingTaxes');
    // Check dynamic authorization
    const authorizations = await AuthorizationService.checkAndGetTaxesAuthorizations(
      req.tenant, req.user, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
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
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING, Action.LIST, Entity.INVOICE, MODULE_NAME, 'handleGetInvoices');
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingInvoicesGetReq(req.query);
    // Check dynamic authorization
    const authorizations = await AuthorizationService.checkAndGetInvoicesAuthorizations(
      req.tenant, req.user, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get invoices
    const invoices = await BillingStorage.getInvoices(req.tenant,
      {
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        invoiceStatus: filteredRequest.Status ? filteredRequest.Status.split('|') as BillingInvoiceStatus[] : null,
        search: filteredRequest.Search ? filteredRequest.Search : null,
        startDateTime: filteredRequest.StartDateTime ? filteredRequest.StartDateTime : null,
        endDateTime: filteredRequest.EndDateTime ? filteredRequest.EndDateTime : null,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      invoices.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addInvoicesAuthorizations(
      req.tenant, req.user, invoices as BillingInvoiceDataResult, authorizations);
    res.json(invoices);
    next();
  }

  public static async handleGetInvoice(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.LIST, Entity.INVOICE, MODULE_NAME, 'handleGetInvoice');
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingInvoiceGetReq(req.query);
    // Check and get invoice
    const invoice = await UtilsService.checkAndGetInvoiceAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {}, true);
    res.json(invoice);
    next();
  }

  public static async handleBillingSetupPaymentMethod(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_SETUP_PAYMENT_METHOD, Entity.BILLING, MODULE_NAME, 'handleSetupSetupPaymentMethod');
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingSetupUserPaymentMethodReq(req.body);
    // Dynamic auth
    await AuthorizationService.checkAndGetPaymentMethodAuthorizations(req.tenant, req.user, filteredRequest, Action.CREATE);
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
    // Check and get user for whom we wish to update the payment method
    const user: User = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID, Action.READ, action);
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
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingGetUserPaymentMethodsReq(req.query);
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_PAYMENT_METHODS, Entity.BILLING, MODULE_NAME, 'handleBillingGetPaymentMethods');
    const authorizations = await AuthorizationService.checkAndGetPaymentMethodsAuthorizations(
      req.tenant, req.user,filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
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
    const user: User = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID, Action.READ, action);
    // Invoke the billing implementation
    const paymentMethods: BillingPaymentMethod[] = await billingImpl.getPaymentMethods(user);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user,
      action: ServerAction.BILLING_PAYMENT_METHODS,
      module: MODULE_NAME, method: 'getPaymentMethods',
      message: `Number of payment methods: ${paymentMethods?.length}`
    });
    const dataResult: BillingPaymentMethodDataResult = {
      count: paymentMethods.length,
      result: paymentMethods
    };
    await AuthorizationService.addPaymentMethodsAuthorizations(req.tenant, req.user, dataResult, authorizations, filteredRequest);
    res.json(dataResult);
    next();
  }

  public static async handleBillingDeletePaymentMethod(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingDeleteUserPaymentMethodReq(req.body);
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.BILLING_PAYMENT_METHODS, Entity.BILLING, MODULE_NAME, 'handleBillingDeletePaymentMethod');
    // Dynamic auth
    await AuthorizationService.checkAndGetPaymentMethodAuthorizations(req.tenant, req.user, filteredRequest, Action.DELETE);
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
    const user: User = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID, Action.READ, action);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleBillingDeletePaymentMethod', req.user);
    // Invoke the billing implementation
    const operationResult: BillingOperationResult = await billingImpl.deletePaymentMethod(user, filteredRequest.paymentMethodId);
    // Log
    await Logging.logInfo({
      tenantID: req.tenant.id,
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
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingInvoiceGetReq(req.query);
    // Get the Invoice
    const billingInvoice = await BillingStorage.getInvoice(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, billingInvoice, `Invoice ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDownloadInvoice', req.user);
    // Check and get authorizations
    await UtilsService.checkAndGetInvoiceAuthorization(req.tenant, req.user, filteredRequest.ID, Action.DOWNLOAD, action, null, {}, true);
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
    const billingSettings: BillingSettings = await UtilsService.checkAndGetBillingSettingAuthorization(req.tenant, req.user, null, Action.READ, action);
    // Process sensitive data
    UtilsService.hashSensitiveData(req.tenant.id, billingSettings);
    res.json(billingSettings);
    next();
  }

  public static async handleUpdateBillingSetting(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING,
      Action.UPDATE, Entity.SETTING, MODULE_NAME, 'handleUpdateBillingSetting');
    const newBillingProperties = BillingValidatorRest.getInstance().validateBillingSettingUpdateReq({ ...req.params, ...req.body });
    // Check and get previous settings that we want to update
    const billingSettings: BillingSettings = await UtilsService.checkAndGetBillingSettingAuthorization(req.tenant, req.user, null, Action.UPDATE, action);
    // Process sensitive data
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

  public static async handleCreateSubAccount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.BILLING_CREATE_SUB_ACCOUNT, Entity.BILLING, MODULE_NAME, 'handleCreateSubAccount');
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingCreateSubAccountReq(req.body);
    // Check authorization
    await AuthorizationService.checkAndGetBillingAuthorizations(req.tenant, req.user, Action.BILLING_CREATE_SUB_ACCOUNT);
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleCreateSubAccount',
        action: action,
        user: req.user
      });
    }
    // Get the user
    const user = await UserStorage.getUser(req.tenant, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleCreateSubAccount', req.user);
    // Create the sub account
    const subAccount = await billingImpl.createSubAccount();
    subAccount.userID = user.id;
    // Save the sub account
    subAccount.id = await BillingStorage.saveSubAccount(req.tenant, subAccount);
    // Notify the user
    void NotificationHandler.sendBillingSubAccountCreationLink(
      req.tenant, Utils.generateUUID(), user, { onboardingLink: subAccount.activationLink, evseDashboardURL: Utils.buildEvseURL(req.tenant.subdomain), user });
    res.status(StatusCodes.CREATED).json(subAccount);
    next();
  }

  public static async handleActivateSubAccount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingActivateSubAccountReq({ ...req.params, ...req.query });
    const tenant = await TenantStorage.getTenant(filteredRequest.TenantID);
    UtilsService.assertObjectExists(action, tenant, `Tenant ID '${filteredRequest.TenantID}' does not exist`, MODULE_NAME, 'handleActivateSubAccount');
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleActivateSubAccount',
        action: action,
        user: req.user
      });
    }
    const subAccount = await BillingStorage.getSubAccountByID(tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, subAccount, `Sub account ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleActivateSubAccount', req.user);
    // Check if the sub account is already activated
    if (!subAccount.pending) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Sub account is already activated',
        module: MODULE_NAME, method: 'handleActivateSubAccount',
        action: action,
        user: req.user
      });
    }
    // Activate and save the sub account
    subAccount.pending = false;
    await BillingStorage.saveSubAccount(tenant, subAccount);
    // Get the sub account owner
    const user = await UserStorage.getUser(tenant, subAccount.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${subAccount.userID}' does not exist`, MODULE_NAME, 'handleActivateSubAccount', req.user);
    // Notify the user
    void NotificationHandler.sendBillingSubAccountActivationNotification(
      tenant, Utils.generateUUID(), user, { evseDashboardURL: Utils.buildEvseURL(tenant.subdomain), user });
    res.status(StatusCodes.OK).json(subAccount);
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
