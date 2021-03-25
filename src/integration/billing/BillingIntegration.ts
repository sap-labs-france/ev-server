import { BillingChargeInvoiceAction, BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceDocument, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethodResult, BillingTax, BillingUser, BillingUserSynchronizeAction } from '../../types/Billing';
/* eslint-disable @typescript-eslint/member-ordering */
import User, { UserStatus } from '../../types/User';

import BackendError from '../../exception/BackendError';
import { BillingSetting } from '../../types/Setting';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { Request } from 'express';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Transaction from '../../types/Transaction';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'BillingIntegration';

export default abstract class BillingIntegration<T extends BillingSetting> {

  // TO BE REMOVED - flag to switch ON/OFF some STRIPE integration logic not yet finalized!
  protected readonly __liveMode: boolean = false;

  protected readonly tenantID: string; // Assuming UUID or other string format ID
  protected settings: T;

  protected constructor(tenantID: string, settings: T) {
    this.tenantID = tenantID;
    this.settings = settings;
  }

  private async _getUsersWithNoBillingData(): Promise<User[]> {
    const newUsers = await UserStorage.getUsers(this.tenantID,
      { 'statuses': [UserStatus.ACTIVE], 'notSynchronizedBillingData': true },
      { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
    if (newUsers.count > 0) {
      return newUsers.result;
    }
    return [];
  }

  public async synchronizeUsers(): Promise<BillingUserSynchronizeAction> {
    await this.checkConnection();
    // Check
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    // Sync e-Mobility Users with no billing data
    const users: User[] = await this._getUsersWithNoBillingData();
    if (users.length > 0) {
      // Process them
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
        module: MODULE_NAME, method: 'synchronizeUsers',
        message: `${users.length} new user(s) are going to be synchronized`
      });
      // Check LIVE MODE
      if (!this.__liveMode) {
        await Logging.logWarning({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          module: MODULE_NAME, method: 'synchronizeUsers',
          message: 'Live Mode is OFF - operation has been aborted'
        });
      } else {
        for (const user of users) {
        // Synchronize user
          if (await this.synchronizeUser(user)) {
            actionsDone.inSuccess++;
          } else {
            actionsDone.inError++;
          }
        }
      }
    }
    // Log
    await Logging.logActionsResponse(this.tenantID, ServerAction.BILLING_SYNCHRONIZE_USERS,
      MODULE_NAME, 'synchronizeUsers', actionsDone,
      '{{inSuccess}} user(s) were successfully synchronized',
      '{{inError}} user(s) failed to be synchronized',
      '{{inSuccess}} user(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the users are up to date'
    );
    // Update last synchronization
    const billingSettings = await SettingStorage.getBillingSettings(this.tenantID);
    billingSettings.stripe.usersLastSynchronizedOn = new Date();
    await SettingStorage.saveBillingSettings(this.tenantID, billingSettings);
    // Result
    return actionsDone;
  }

  public async synchronizeUser(user: User): Promise<BillingUser> {
    try {
      const billingUser = await this._synchronizeUser(user);
      await Logging.logInfo({
        tenantID: this.tenantID,
        actionOnUser: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'synchronizeUser',
        message: `Successfully synchronized user: '${user.id}' - '${user.email}'`,
      });
      return billingUser;
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenantID,
        actionOnUser: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'synchronizeUser',
        message: `Failed to synchronize user: '${user.id}' - '${user.email}'`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    return null;
  }

  public async forceSynchronizeUser(user: User): Promise<BillingUser> {
    try {
      const billingUser = await this._synchronizeUser(user, true /* !forceMode */);
      if (user?.billingData?.customerID !== billingUser?.billingData?.customerID) {
        await Logging.logWarning({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
          module: MODULE_NAME, method: 'forceSynchronizeUser',
          message: `CustomerID has been repaired - old value ${user?.billingData?.customerID} - ${billingUser?.billingData?.customerID}`
        });
      }
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        actionOnUser: user,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        message: `Successfully forced the synchronization of user: '${user.id}' - '${user.email}'`,
      });
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenantID,
        actionOnUser: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        message: `Failed to force the synchronization of user: '${user.id}' - '${user.email}'`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    return null;
  }

  private async _synchronizeUser(user: User, forceMode = false): Promise<BillingUser> {
    // Check if we need to create or update a STRIPE customer
    let exists;
    if (!forceMode) {
      // -------------------------------------------------------------------------------------------
      // Regular Situation - CustomerID is set and we trust it!
      // -------------------------------------------------------------------------------------------
      exists = await this.isUserSynchronized(user); // returns false when the customerID is not set
    } else {
      // -------------------------------------------------------------------------------------------
      // Specific use-case - Trying to REPAIR inconsistencies
      // CustomerID is set, but the corresponding data does not exist anymore on the STRIPE side
      // -------------------------------------------------------------------------------------------
      try {
        exists = await this.getUser(user);
      } catch (error) {
        // Let's create a new customer and get rid of the previous customerID
        exists = false;
      }
    }
    // Create or Update the user and its billing data
    let billingUser: BillingUser;
    if (!exists) {
      billingUser = await this.createUser(user);
    } else {
      billingUser = await this.updateUser(user);
    }
    await UserStorage.saveUserBillingData(this.tenantID, user.id, billingUser.billingData);
    return billingUser;
  }

  public async synchronizeInvoices(user?: User): Promise<BillingUserSynchronizeAction> {
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    // Check LIVE MODE
    if (!this.__liveMode) {
      await Logging.logWarning({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        message: 'Live Mode is OFF - operation has been aborted'
      });
      return actionsDone;
    }
    // Check billing settings consistency
    await this.checkConnection();
    // Let's make sure the billing data is consistent
    let billingUser: BillingUser = null;
    if (user) {
      billingUser = await this.checkUser(user);
    }
    // Fetch the list of updated invoice
    const invoiceIDs: string[] = await this.getUpdatedInvoiceIDsInBilling(billingUser);
    if (invoiceIDs?.length > 0) {
      await Logging.logInfo({
        tenantID: this.tenantID,
        user: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        message: `${invoiceIDs.length} billing invoice(s) are going to be synchronized`
      });
      for (const invoiceID of invoiceIDs) {
        try {
          // Let's replicate invoice data as a Billing Invoice
          const billingInvoice = await this.synchronizeAsBillingInvoice(invoiceID, true /* checkUserExists */);
          // Make sure we get the actual user - the one the invoice refers to
          const userInInvoice = await UserStorage.getUser(this.tenantID, billingInvoice.userID);
          // Update user billing data
          const billingData = {
            ...userInInvoice.billingData,
            invoicesLastSynchronizedOn: new Date()
          };
          // Update the invoicesLastSynchronizedOn property of the user
          userInInvoice.billingData.invoicesLastSynchronizedOn = new Date();
          await UserStorage.saveUserBillingData(this.tenantID, billingInvoice.userID, billingData);
          // Ok
          actionsDone.inSuccess++;
          await Logging.logDebug({
            tenantID: this.tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
            module: MODULE_NAME, method: 'synchronizeInvoices',
            message: `Invoice with ID '${invoiceID}' has been replicated in e-Mobility`,
            detailedMessages: { billingInvoice, userInInvoice }
          });
        } catch (error) {
          actionsDone.inError++;
          await Logging.logError({
            tenantID: this.tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
            module: MODULE_NAME, method: 'synchronizeInvoices',
            message: `Unable to process the invoice with ID '${invoiceID}'`,
            detailedMessages: { error: error.message, stack: error.stack, invoiceID }
          });
        }
      }
    }
    // Log
    await Logging.logActionsResponse(this.tenantID, ServerAction.BILLING_SYNCHRONIZE_INVOICES,
      MODULE_NAME, 'synchronizeInvoices', actionsDone,
      '{{inSuccess}} invoice(s) were successfully synchronized',
      '{{inError}} invoice(s) failed to be synchronized',
      '{{inSuccess}} invoice(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the invoices are up to date'
    );
    if (!user) {
      // Update global last synchronization timestamp
      const billingSettings = await SettingStorage.getBillingSettings(this.tenantID);
      billingSettings.stripe.invoicesLastSynchronizedOn = new Date();
      await SettingStorage.saveBillingSettings(this.tenantID, billingSettings);
    }
    return actionsDone;
  }

  public async chargeInvoices(): Promise<BillingChargeInvoiceAction> {
    const actionsDone: BillingChargeInvoiceAction = {
      inSuccess: 0,
      inError: 0
    };
    await this.checkConnection();
    const openedInvoices = await BillingStorage.getInvoicesToPay(this.tenantID);
    // Let's now try to pay opened invoices
    for (const openInvoice of openedInvoices.result) {
      try {
        await this.chargeInvoice(openInvoice);
        await Logging.logInfo({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_CHARGE_INVOICE,
          module: MODULE_NAME, method: 'chargeInvoices',
          message: `Successfully charged invoice '${openInvoice.id}'`
        });
        actionsDone.inSuccess++;
      } catch (error) {
        actionsDone.inError++;
        await Logging.logError({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          module: MODULE_NAME, method: 'chargeInvoices',
          message: `Failed to charge invoice '${openInvoice.id}'`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    return actionsDone;
  }

  public async sendInvoiceNotification(billingInvoice: BillingInvoice): Promise<void> {
    // Do not send notifications for invoices that are not yet finalized!
    if (billingInvoice.status === BillingInvoiceStatus.OPEN || billingInvoice.status === BillingInvoiceStatus.PAID) {
      // Send link to the user using our notification framework (link to the front-end + download)
      const tenant = await TenantStorage.getTenant(this.tenantID);
      // Send async notification
      await NotificationHandler.sendBillingNewInvoiceNotification(
        this.tenantID,
        billingInvoice.id,
        billingInvoice.user,
        {
          user: billingInvoice.user,
          evseDashboardInvoiceURL: Utils.buildEvseBillingInvoicesURL(tenant.subdomain),
          evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
          invoiceDownloadUrl: Utils.buildEvseBillingDownloadInvoicesURL(tenant.subdomain, billingInvoice.id),
          invoice: billingInvoice
        }
      );
    }
  }

  public checkStopTransaction(transaction: Transaction): void {
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Charging Station
    if (!transaction.chargeBox) {
      throw new BackendError({
        message: 'Charging Station is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Charging Station
    if (transaction?.billingData?.invoiceID) {
      throw new BackendError({
        message: 'Transaction has already billing data',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    if (this.__liveMode) {
      // Check Billing Data (only in Live Mode)
      if (!transaction.user.billingData) {
        throw new BackendError({
          message: 'User has no Billing Data',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'checkStopTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
    } else {
      void Logging.logWarning({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'checkStopTransaction',
        message: 'Live Mode is OFF - checkStopTransaction is being performed without checking billing data'
      });
    }
  }

  public checkStartTransaction(transaction: Transaction): void {
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStartTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    if (this.__liveMode) {
      // Check Billing Data (only in Live Mode)
      const billingUser = transaction.user;
      if (!billingUser.billingData || !billingUser.billingData.customerID) {
        throw new BackendError({
          message: 'Transaction user has no billing method or no customer in Stripe',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'checkStartTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
    } else {
      void Logging.logWarning({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'checkStartTransaction',
        message: 'Live Mode is OFF - checkStartTransaction is being performed without checking billing data'
      });
    }
  }

  private async checkUser(user: User): Promise<BillingUser> {
    // Check the user data
    if (!user?.billingData?.customerID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        user: user,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'User has no billing data in e-Mobility',
        detailedMessages: { user }
      });
    }
    // Check billing user data
    const billingUser = await this.getUser(user);
    if (!billingUser?.billingData?.customerID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        user: user,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'User has no billing data in billing system',
        detailedMessages: { user, billingUser }
      });
    }
    if (user.billingData.customerID !== billingUser.billingData.customerID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        user: user,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'Billing data is inconsistent',
        detailedMessages: { user, billingUser }
      });
    }
    return billingUser;
  }

  abstract checkConnection(): Promise<void>;

  abstract startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart>;

  abstract updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate>;

  abstract stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  abstract checkIfUserCanBeCreated(user: User): Promise<boolean>;

  abstract checkIfUserCanBeUpdated(user: User): Promise<boolean>;

  abstract checkIfUserCanBeDeleted(user: User): Promise<boolean>;

  abstract getUsers(): Promise<BillingUser[]>;

  abstract getUser(user: User): Promise<BillingUser>;

  abstract createUser(user: User): Promise<BillingUser>;

  abstract updateUser(user: User): Promise<BillingUser>;

  abstract deleteUser(user: User): Promise<void>;

  abstract isUserSynchronized(user: User): Promise<boolean>;

  abstract getTaxes(): Promise<BillingTax[]>;

  abstract getUpdatedInvoiceIDsInBilling(billingUser?: BillingUser): Promise<string[]>;

  abstract synchronizeAsBillingInvoice(stripeInvoiceID: string, checkUserExists: boolean): Promise<BillingInvoice>;

  abstract billInvoiceItem(user: User, billingInvoiceItems: BillingInvoiceItem, idemPotencyKey?: string): Promise<BillingInvoice>;

  abstract downloadInvoiceDocument(invoice: BillingInvoice): Promise<BillingInvoiceDocument>;

  abstract chargeInvoice(invoice: BillingInvoice): Promise<BillingInvoice>;

  abstract consumeBillingEvent(req: Request): Promise<boolean>;

  abstract setupPaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult>;

  abstract getPaymentMethods(user: User): Promise<BillingPaymentMethodResult>;

  abstract deletePaymentMethod(user: User, paymentMethodId: string): Promise<BillingPaymentMethodResult>;
}
