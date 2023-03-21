import { Action, Entity } from '../../../../types/Authorization';
import { BillingAccount, BillingAccountStatus, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingTransferStatus } from '../../../../types/Billing';
import { BillingInvoiceDataResult, BillingPaymentMethodDataResult, BillingTaxDataResult } from '../../../../types/DataResult';
import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import { BillingAccountCreationLinkNotification } from '../../../../types/UserNotifications';
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
    const dataResult: BillingTaxDataResult = {
      count: taxes.length,
      result: taxes,
    };
    AuthorizationService.addTaxesAuthorizations(req.tenant, req.user, dataResult, authorizations);
    res.json(dataResult);
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
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addInvoicesAuthorizations(req.tenant, req.user, invoices as BillingInvoiceDataResult, authorizations);
    }
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
      req.tenant, req.user, filteredRequest, false);
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
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addPaymentMethodsAuthorizations(req.tenant, req.user, dataResult, authorizations, filteredRequest);
    }
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

  public static async handleTransferInvoiceDownload(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.DOWNLOAD, Entity.BILLING_PLATFORM, MODULE_NAME, 'handleTransferInvoiceDownload');
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingTransferGetReq(req.query);
    // Get the Invoice
    const billingTransfer = await BillingStorage.getTransfer(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, billingTransfer, `Transfer ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleTransferInvoiceDownload', req.user);
    // Check and get authorizations
    await UtilsService.checkAndGetTransferAuthorization(req.tenant, req.user, filteredRequest.ID, Action.DOWNLOAD, action, null, {}, true);
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleTransferInvoiceDownload',
        action: action,
        user: req.user
      });
    }
    const buffer = await billingImpl.downloadTransferInvoiceDocument(billingTransfer);
    if (!billingTransfer.invoice.invoiceID || !buffer) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Transfer document not found',
        module: MODULE_NAME, method: 'handleTransferInvoiceDownload',
        action: action,
        user: req.user
      });
    }
    const fileName = 'invoice_' + billingTransfer.invoice.invoiceID + '.pdf';
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
    const { immediateBillingAllowed, periodicBillingAllowed, taxID, platformFeeTaxID } = newBillingProperties.billing;
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
      isTransactionBillingActivated = false;
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
      platformFeeTaxID,
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

  public static async handleOnboardAccount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.BILLING_ONBOARD_ACCOUNT, Entity.BILLING_ACCOUNT, MODULE_NAME, 'handleOnboardAccount');
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingAccountGetReq(req.params);
    // Check authorization
    await AuthorizationService.checkAndGetBillingAccountAuthorizations(req.tenant, req.user, filteredRequest, Action.BILLING_ONBOARD_ACCOUNT);
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleCreateAccount',
        action: action,
        user: req.user
      });
    }
    // Fetch the current account data
    let billingAccount = await BillingStorage.getAccountByID(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, billingAccount, `Account ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleOnboardAccount', req.user);
    // Check if the account onboarding is already sent
    if (billingAccount.status !== BillingAccountStatus.IDLE) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Account onboarding aborted - current status should be IDLE',
        module: MODULE_NAME, method: 'handleOnboardAccount',
        action: action,
        user: req.user
      });
    }
    // Get the account owner
    const user = await UserStorage.getUser(req.tenant, billingAccount.businessOwnerID);
    UtilsService.assertObjectExists(action, user, `User ID '${billingAccount.businessOwnerID}' does not exist`, MODULE_NAME, 'handleOnboardAccount', req.user);
    // Trigger the creation of the connected account
    const connectedAccount = await billingImpl.createConnectedAccount();
    // Update account properties
    billingAccount = {
      ...billingAccount,
      ...connectedAccount,
      status: BillingAccountStatus.PENDING,
      lastChangedBy: { 'id': req.user.id },
      lastChangedOn: new Date()
    };
    // Save the account
    await BillingStorage.saveAccount(req.tenant, billingAccount);
    // URL to the DASHBOARD Onboarding Page
    const onboardingURL = Utils.buildEvseBillingAccountOnboardingURL(req.tenant, billingAccount.id);
    // Notify the user
    const notificationData : BillingAccountCreationLinkNotification = {
      onboardingLink: onboardingURL,
      evseDashboardURL: Utils.buildEvseURL(req.tenant.subdomain),
      user
    };
    // Send the notification
    NotificationHandler.sendBillingAccountCreationLink(req.tenant, Utils.generateUUID(), user, notificationData).catch((error) => {
      Logging.logPromiseError(error, req?.tenant?.id);
    });
    res.json(Object.assign({ id: billingAccount.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleCreateAccount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.CREATE, Entity.BILLING_ACCOUNT, MODULE_NAME, 'handleCreateAccount');
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingCreateAccountReq(req.body);
    // Check authorization
    await AuthorizationService.checkAndGetBillingAccountAuthorizations(req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleCreateAccount',
        action: action,
        user: req.user
      });
    }
    // Get the user
    const user = await UserStorage.getUser(req.tenant, filteredRequest.businessOwnerID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.businessOwnerID}' does not exist`,
      MODULE_NAME, 'handleCreateAccount', req.user);
    // Create a initial Account data - stripe creation is postponed
    const billingAccount: BillingAccount = {
      businessOwnerID: user.id,
      status: BillingAccountStatus.IDLE,
      accountExternalID: null,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      companyName: filteredRequest.companyName
    };
    // Save the account
    billingAccount.id = await BillingStorage.saveAccount(req.tenant, billingAccount);
    res.json(Object.assign({ id: billingAccount.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleRefreshAccount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Tenant
    if (!req.tenant) {
      throw new AppError({
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Tenant must be provided',
        module: MODULE_NAME, method: 'handleRefreshAccount', action: action,
      });
    }
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingActivateAccountReq({ ...req.params, ...req.body });
    let billingAccount = await BillingStorage.getAccountByID(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, billingAccount, `Account ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleRefreshAccount', req.user);
    // Check if the account onboarding has been sent
    if (billingAccount.status !== BillingAccountStatus.PENDING) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Account onboarding aborted - current status should be PENDING',
        module: MODULE_NAME, method: 'handleRefreshAccount',
        action: action,
        user: req.user
      });
    }
    // Get the account owner
    const user = await UserStorage.getUser(req.tenant, billingAccount.businessOwnerID);
    UtilsService.assertObjectExists(action, user, `User ID '${billingAccount.businessOwnerID}' does not exist`, MODULE_NAME, 'handleRefreshAccount', req.user);
    // Get the billing impl
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleRefreshAccount',
        action: action,
        user: req.user
      });
    }
    // URL to the DASHBOARD Onboarding Page
    const onboardingURL = Utils.buildEvseBillingAccountOnboardingURL(req.tenant, billingAccount.id);
    // Refresh the activation link
    const refreshedAccount = await billingImpl.refreshConnectedAccount(billingAccount, onboardingURL);
    // Update account properties
    billingAccount = {
      ...billingAccount,
      activationLink: refreshedAccount.activationLink, // URL to the STRIPE Onboarding Wizard
    };
    // Save the account
    await BillingStorage.saveAccount(req.tenant, billingAccount);
    // Send back the activation link
    res.json(Object.assign({
      id: billingAccount.id,
      activationLink: billingAccount.activationLink
    }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleActivateAccount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Tenant
    if (!req.tenant) {
      throw new AppError({
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Tenant must be provided',
        module: MODULE_NAME, method: 'handleActivateAccount', action: action,
      });
    }
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingActivateAccountReq({ ...req.params, ...req.body });
    const billingAccount = await BillingStorage.getAccountByID(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, billingAccount, `Account ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleActivateAccount', req.user);
    // Check if the account onboarding has been sent
    if (billingAccount.status !== BillingAccountStatus.PENDING) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Account onboarding aborted - current status should be PENDING',
        module: MODULE_NAME, method: 'handleActivateAccount',
        action: action,
        user: req.user
      });
    }
    // Get the account owner
    const user = await UserStorage.getUser(req.tenant, billingAccount.businessOwnerID);
    UtilsService.assertObjectExists(action, user, `User ID '${billingAccount.businessOwnerID}' does not exist`, MODULE_NAME, 'handleActivateAccount', req.user);
    // Activate and save the account
    billingAccount.status = BillingAccountStatus.ACTIVE;
    await BillingStorage.saveAccount(req.tenant, billingAccount);
    // Notify the user
    NotificationHandler.sendBillingAccountActivationNotification(
      req.tenant, Utils.generateUUID(), user, { evseDashboardURL: Utils.buildEvseURL(req.tenant.subdomain), user }
    ).catch((error) => {
      Logging.logPromiseError(error, req?.tenant?.id);
    });
    res.json(Object.assign({ id: billingAccount.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleBillingGetAccounts(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingAccountsGetReq(req.query);
    // Check auth
    const authorizations = await AuthorizationService.checkAndGetBillingAccountsAuthorizations(req.tenant, req.user, filteredRequest /* , false */);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the billing accounts
    const billingAccounts = await BillingStorage.getAccounts(req.tenant, {
      IDs: filteredRequest.ID ? filteredRequest.ID.split('|') : null,
      userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
      search: filteredRequest.Search ? filteredRequest.Search : null,
      status: filteredRequest.Status ? filteredRequest.Status.split('|') : null,
    }, {
      sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
      skip: filteredRequest.Skip,
      limit: filteredRequest.Limit,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    },
    authorizations.projectFields
    );
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addAccountsAuthorizations(req.tenant, req.user, billingAccounts, authorizations);
    }
    res.json(billingAccounts);
    next();
  }

  public static async handleBillingGetAccount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingAccountGetReq(req.params);
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.READ, Entity.BILLING_ACCOUNT, MODULE_NAME, 'handleBillingGetAccount');
    // Get the billing accounts
    const billingAccount = await UtilsService.checkAndGetBillingAccountAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {}, true);
    res.json(billingAccount);
    next();
  }

  public static async handleBillingGetTransfers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingTransfersGetReq(req.query);
    // Check auth
    const authorizations = await AuthorizationService.checkAndGetTransfersAuthorizations(req.tenant, req.user, Action.LIST, filteredRequest /* , false */);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the billing accounts
    const transfers = await BillingStorage.getTransfers(req.tenant, {
      IDs: filteredRequest.ID ? filteredRequest.ID.split('|') : null,
      accountIDs: filteredRequest.AccountID ? filteredRequest.AccountID.split('|') : null,
      transferExternalIDs: filteredRequest.TransferExternalID ? filteredRequest.TransferExternalID.split('|') : null,
      search: filteredRequest.Search ? filteredRequest.Search : null,
      status: filteredRequest.Status ? filteredRequest.Status.split('|') : null,
    }, {
      sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
      skip: filteredRequest.Skip,
      limit: filteredRequest.Limit,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    },
    authorizations.projectFields
    );
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addTransfersAuthorizations(req.tenant, req.user, transfers, authorizations);
    }
    res.json(transfers);
    next();
  }

  public static async handleGetTransfer(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.READ, Entity.BILLING_TRANSFER, MODULE_NAME, 'handleGetTransfer');
    // Filter
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingTransferGetReq(req.query);
    // Check and Get Company
    const transfer = await UtilsService.checkAndGetTransferAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {}, true);
    res.json(transfer);
    next();
  }

  public static async handleFinalizeTransfer(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.BILLING_FINALIZE_TRANSFER, Entity.BILLING_TRANSFER, MODULE_NAME, 'handleFinalizeTransfer');
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingTransferFinalizeReq(req.params);
    // Check authorization
    await AuthorizationService.checkAndGetTransfersAuthorizations(req.tenant, req.user, Action.BILLING_FINALIZE_TRANSFER);
    // Get the billing implementation
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleFinalizeTransfer',
        action: action,
        user: req.user
      });
    }
    // Get the transfer
    let transfer = await BillingStorage.getTransfer(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, transfer, `Transfer ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleFinalizeTransfer', req.user);
    // Check if the transfer is in draft status
    if (transfer.status !== BillingTransferStatus.DRAFT) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Transfer finalization aborted - current status should be DRAFT',
        module: MODULE_NAME, method: 'handleFinalizeTransfer',
        action: action,
        user: req.user
      });
    }
    // Get the targeted account
    const billingAccount = await BillingStorage.getAccountByID(req.tenant, transfer.accountID);
    UtilsService.assertObjectExists(action, billingAccount, `Account ID '${transfer.accountID}' does not exist`, MODULE_NAME, 'handleSendTransferInvoice', req.user);
    // Get the account owner
    const user = await UserStorage.getUser(req.tenant, billingAccount.businessOwnerID);
    UtilsService.assertObjectExists(action, user, `User ID '${billingAccount.businessOwnerID}' does not exist`, MODULE_NAME, 'handleSendTransferInvoice', req.user);
    // Generate the invoice with a fee per session
    const invoice = await billingImpl.billPlatformFee(transfer, user, billingAccount);
    // Funds to transfer
    const transferAmount = Utils.createDecimal(transfer.collectedFunds).minus(invoice.totalAmount).toNumber();
    // Update transfer properties
    transfer = {
      ...transfer,
      status: BillingTransferStatus.FINALIZED,
      transferAmount,
      invoice, // Keep track of some invoice data
      lastChangedBy: { id: req.user.id },
      lastChangedOn: new Date()
    };
    // Save transfer
    await BillingStorage.saveTransfer(req.tenant, transfer);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleSendTransfer(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
      Action.BILLING_SEND_TRANSFER, Entity.BILLING_TRANSFER, MODULE_NAME, 'handleSendTransferInvoice');
    const filteredRequest = BillingValidatorRest.getInstance().validateBillingTransferSendReq(req.params);
    // Check authorization
    await AuthorizationService.checkAndGetTransfersAuthorizations(req.tenant, req.user, Action.BILLING_SEND_TRANSFER);
    // Get the billing implementation
    const billingImpl = await BillingFactory.getBillingImpl(req.tenant);
    if (!billingImpl) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Billing service is not configured',
        module: MODULE_NAME, method: 'handleSendTransfer',
        action: action,
        user: req.user
      });
    }
    // Get the transfer
    let transfer = await BillingStorage.getTransfer(req.tenant, filteredRequest.ID);
    UtilsService.assertObjectExists(action, transfer, `Transfer ID '${filteredRequest.ID}' does not exist`, MODULE_NAME, 'handleSendTransfer', req.user);
    // Check if the transfer is in draft status
    if (transfer.status !== BillingTransferStatus.FINALIZED) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Operation aborted - current status should be FINALIZED',
        module: MODULE_NAME, method: 'handleSendTransfer',
        action: action,
        user: req.user
      });
    }
    // Get the targeted account
    const billingAccount = await BillingStorage.getAccountByID(req.tenant, transfer.accountID);
    UtilsService.assertObjectExists(action, billingAccount, `Account ID '${transfer.accountID}' does not exist`, MODULE_NAME, 'handleSendTransfer', req.user);
    // Get the account owner
    const user = await UserStorage.getUser(req.tenant, billingAccount.businessOwnerID);
    UtilsService.assertObjectExists(action, user, `User ID '${billingAccount.businessOwnerID}' does not exist`, MODULE_NAME, 'handleSendTransfer', req.user);
    // Send the funds
    const transferExternalID = await billingImpl.sendTransfer(transfer, user);
    // Update transfer properties
    transfer = {
      ...transfer,
      transferExternalID,
      status: BillingTransferStatus.TRANSFERRED,
      lastChangedBy: { id: req.user.id },
      lastChangedOn: new Date()
    };
    // Save transfer
    await BillingStorage.saveTransfer(req.tenant, transfer);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async checkActivationPrerequisites(action: ServerAction, req: Request): Promise<void> {
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
