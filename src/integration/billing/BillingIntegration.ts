import { BillingChargeInvoiceAction, BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingTax, BillingUser, BillingUserSynchronizeAction } from '../../types/Billing';
import FeatureToggles, { Feature } from '../../utils/FeatureToggles';
import User, { UserStatus } from '../../types/User';

import BackendError from '../../exception/BackendError';
import { BillingSettings } from '../../types/Setting';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { Request } from 'express';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Transaction from '../../types/Transaction';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'BillingIntegration';

export default abstract class BillingIntegration {

  // Production Mode is set to true when the STRIPE account is a live one!
  protected productionMode = false;

  protected readonly tenantID: string; // Assuming UUID or other string format ID
  protected settings: BillingSettings;

  protected constructor(tenantID: string, settings: BillingSettings) {
    this.tenantID = tenantID;
    this.settings = settings;
  }

  public async synchronizeUsers(): Promise<BillingUserSynchronizeAction> {
    await this.checkConnection();
    // Check
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    if (FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USERS)) {
      // Sync e-Mobility Users with no billing data
      const users = await this._getUsersWithNoBillingData();
      if (!Utils.isEmptyArray(users)) {
        // Process them
        await Logging.logInfo({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          module: MODULE_NAME, method: 'synchronizeUsers',
          message: `${users.length} new user(s) are going to be synchronized`
        });
        for (const user of users) {
          // Synchronize user
          if (await this.synchronizeUser(user)) {
            actionsDone.inSuccess++;
          } else {
            actionsDone.inError++;
          }
        }
      }
    } else {
      await Logging.logWarning({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
        module: MODULE_NAME, method: 'synchronizeUsers',
        message: 'Feature is switched OFF - operation has been aborted'
      });
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
    this.settings.billing.usersLastSynchronizedOn = new Date();
    await SettingStorage.saveBillingSetting(this.tenantID, this.settings);
    // Result
    return actionsDone;
  }

  public async synchronizeUser(user: User): Promise<BillingUser> {
    let billingUser: BillingUser = null;
    if (FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USER)) {
      try {
        billingUser = await this._synchronizeUser(user);
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
    } else {
      await Logging.logWarning({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'synchronizeUser',
        message: 'Feature is switched OFF - operation has been aborted'
      });
    }
    return billingUser;
  }

  public async forceSynchronizeUser(user: User): Promise<BillingUser> {
    let billingUser: BillingUser = null;
    try {
      billingUser = await this._synchronizeUser(user, true /* !forceMode */);
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
    return billingUser;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async synchronizeInvoices(user?: User): Promise<BillingUserSynchronizeAction> {
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    await Logging.logWarning({
      tenantID: this.tenantID,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
      module: MODULE_NAME, method: 'synchronizeInvoices',
      message: 'Method is deprecated - operation skipped'
    });
    return actionsDone;
  }

  public async chargeInvoices(): Promise<BillingChargeInvoiceAction> {
    const actionsDone: BillingChargeInvoiceAction = {
      inSuccess: 0,
      inError: 0
    };
    await this.checkConnection();

    let invoices: DataResult<BillingInvoice>;
    if (this.settings.billing?.periodicBillingAllowed) {
      // Fetch DRAFT and OPEN invoices
      invoices = await BillingStorage.getInvoicesToProcess(this.tenantID);
    } else {
      // Fetch OPEN invoices only
      invoices = await BillingStorage.getInvoicesToPay(this.tenantID);
    }
    // Let's now finalize all invoices and attempt to get it paid
    for (const invoice of invoices.result) {
      try {
        // Make sure to avoid trying to charge it again too soon
        if (moment(invoice.createdOn).isSame(moment(), 'day')) {
          actionsDone.inSuccess++;
          await Logging.logWarning({
            tenantID: this.tenantID,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_CHARGE_INVOICE,
            actionOnUser: invoice.user,
            module: MODULE_NAME, method: 'chargeInvoices',
            message: `Invoice is too new - Operation has been skipped - '${invoice.id}'`
          });
          continue;
        }
        await this.chargeInvoice(invoice);
        await Logging.logInfo({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_CHARGE_INVOICE,
          actionOnUser: invoice.user,
          module: MODULE_NAME, method: 'chargeInvoices',
          message: `Successfully charged invoice '${invoice.id}'`
        });
        actionsDone.inSuccess++;
      } catch (error) {
        actionsDone.inError++;
        await Logging.logError({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_CHARGE_INVOICE,
          actionOnUser: invoice.user,
          module: MODULE_NAME, method: 'chargeInvoices',
          message: `Failed to charge invoice '${invoice.id}'`,
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
          // Empty url allows to decide wether to display "pay" button in the email
          payInvoiceUrl: billingInvoice.status === 'open' ? billingInvoice.payInvoiceUrl : '',
          // Stripe saves amount in cents
          invoiceAmount: Utils.createDecimal(billingInvoice.amount).div(100),
          invoiceNumber: billingInvoice.number,
          invoiceStatus: billingInvoice.status,
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
    // Check Billing Data
    if (!transaction.user?.billingData?.customerID) {
      if (FeatureToggles.isFeatureActive(Feature.BILLING_CHECK_USER_BILLING_DATA)) {
        throw new BackendError({
          message: 'User has no Billing Data',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'checkStopTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
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
    // Check Billing Data (only in Live Mode)
    if (!transaction.user?.billingData?.customerID) {
      if (FeatureToggles.isFeatureActive(Feature.BILLING_CHECK_USER_BILLING_DATA)) {
        throw new BackendError({
          message: 'User has no billing data or no customer in Stripe',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'checkStartTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
    }
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

  private async _synchronizeUser(user: User, forceMode = false): Promise<BillingUser> {
    // Check if we need to create or update a STRIPE customer
    let billingUser: BillingUser = null;
    if (!forceMode) {
      // ------------------
      // Regular Situation
      // ------------------
      const exists = await this.isUserSynchronized(user); // returns false when the customerID is not set
      if (!exists) {
        billingUser = await this.createUser(user);
      } else {
        billingUser = await this.updateUser(user);
      }
    } else {
      // ----------------------------------------------------------------------------------------------
      // Specific use-case - Trying to REPAIR inconsistencies
      // e.g.: CustomerID is set, but the corresponding data does not exist anymore on the STRIPE side
      // ----------------------------------------------------------------------------------------------
      try {
        billingUser = await this.getUser(user);
        if (!billingUser) {
          billingUser = await this.createUser(user);
        } else {
          billingUser = await this.updateUser(user);
        }
      } catch (error) {
        // Let's repair it
        billingUser = await this.repairUser(user);
      }
    }
    return billingUser;
  }

  abstract checkConnection(): Promise<void>;

  abstract checkActivationPrerequisites(): Promise<void>;

  abstract startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart>;

  abstract updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate>;

  abstract stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  abstract billTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  abstract checkIfUserCanBeCreated(user: User): Promise<boolean>;

  abstract checkIfUserCanBeUpdated(user: User): Promise<boolean>;

  abstract checkIfUserCanBeDeleted(user: User): Promise<boolean>;

  abstract getUsers(): Promise<BillingUser[]>;

  abstract getUser(user: User): Promise<BillingUser>;

  abstract createUser(user: User): Promise<BillingUser>;

  abstract updateUser(user: User): Promise<BillingUser>;

  abstract repairUser(user: User): Promise<BillingUser>;

  abstract deleteUser(user: User): Promise<void>;

  abstract isUserSynchronized(user: User): Promise<boolean>;

  abstract getTaxes(): Promise<BillingTax[]>;

  abstract synchronizeAsBillingInvoice(stripeInvoiceID: string, checkUserExists: boolean): Promise<BillingInvoice>;

  abstract billInvoiceItem(user: User, billingInvoiceItems: BillingInvoiceItem, idemPotencyKey?: string): Promise<BillingInvoice>;

  abstract downloadInvoiceDocument(invoice: BillingInvoice): Promise<Buffer>;

  abstract chargeInvoice(invoice: BillingInvoice): Promise<BillingInvoice>;

  abstract consumeBillingEvent(req: Request): Promise<boolean>;

  abstract setupPaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult>;

  abstract getPaymentMethods(user: User): Promise<BillingPaymentMethod[]>;

  abstract deletePaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult>;


}
