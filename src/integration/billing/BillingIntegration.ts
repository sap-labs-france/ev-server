/* eslint-disable @typescript-eslint/member-ordering */
import { BillingAccount, BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingPlatformFeeStrategy, BillingPlatformInvoice, BillingSessionAccountData, BillingStatus, BillingTax, BillingTransfer, BillingTransferStatus, BillingUser } from '../../types/Billing';
import { BillingPeriodicOperationTaskConfig, DispatchFundsTaskConfig } from '../../types/TaskConfig';
import Tenant, { TenantComponents } from '../../types/Tenant';
import Transaction, { CollectedFundReport, StartTransactionErrorCode } from '../../types/Transaction';
import User, { UserStatus } from '../../types/User';

import { ActionsResponse } from '../../types/GlobalType';
import BackendError from '../../exception/BackendError';
import { BillingSettings } from '../../types/Setting';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import { Decimal } from 'decimal.js';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import NotificationHandler from '../../notification/NotificationHandler';
import { Promise } from 'bluebird';
import { Request } from 'express';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'BillingIntegration';
export default abstract class BillingIntegration {
  // Production Mode is set to true when the target account is a live one!
  protected productionMode = false;

  protected readonly tenant: Tenant; // Assuming UUID or other string format ID
  protected settings: BillingSettings;

  protected constructor(tenant: Tenant, settings: BillingSettings) {
    this.tenant = tenant;
    this.settings = settings;
  }

  public async synchronizeUser(user: User): Promise<BillingUser> {
    let billingUser: BillingUser = null;
    try {
      billingUser = await this._synchronizeUser(user);
      await Logging.logInfo({
        tenantID: this.tenant.id,
        actionOnUser: user,
        action: ServerAction.BILLING_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'synchronizeUser',
        message: `Successfully synchronized user: '${user.id}' - '${user.email}'`,
      });
      return billingUser;
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        actionOnUser: user,
        action: ServerAction.BILLING_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'synchronizeUser',
        message: `Failed to synchronize user: '${user.id}' - '${user.email}'`,
        detailedMessages: { error: error.stack }
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
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
          module: MODULE_NAME, method: 'forceSynchronizeUser',
          message: `CustomerID has been repaired - old value ${user?.billingData?.customerID} - ${billingUser?.billingData?.customerID}`
        });
      }
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        actionOnUser: user,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        message: `Successfully forced the synchronization of user: '${user.id}' - '${user.email}'`,
      });
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        actionOnUser: user,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        message: `Failed to force the synchronization of user: '${user.id}' - '${user.email}'`,
        detailedMessages: { error: error.stack }
      });
    }
    return billingUser;
  }

  public async chargeInvoices(taskConfig: BillingPeriodicOperationTaskConfig): Promise<ActionsResponse> {
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Check connection
    await this.checkConnection();
    // Prepare filtering and sorting
    let queryParameters : { limit: number, sort: Record<string, unknown>, filter: Record<string, unknown> };
    if (taskConfig?.onlyProcessUnpaidInvoices) {
      // ACHTUNG - Job configuration is sensitive - Too many payment retries may violate card network rules
      queryParameters = this.prepareRetryPaymentQueryParameters(taskConfig?.forceOperation);
    } else {
      queryParameters = this.preparePeriodicBillingQueryParameters(taskConfig?.forceOperation);
    }
    if (!queryParameters) {
      // Nothing to do!
      return actionsDone;
    }
    // Let's perform the operation
    const { filter, sort, limit } = queryParameters;
    let skip = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const invoices = await BillingStorage.getInvoices(this.tenant, filter, { sort, limit, skip });
      if (Utils.isEmptyArray(invoices.result)) {
        break;
      }
      skip += limit;
      for (const invoice of invoices.result) {
        try {
          // Make sure to avoid trying to charge it again too soon
          if (!taskConfig?.forceOperation && moment(invoice.createdOn).isSame(moment(), 'day')) {
            actionsDone.inSuccess++;
            await Logging.logWarning({
              tenantID: this.tenant.id,
              action: ServerAction.BILLING_PERFORM_OPERATIONS,
              actionOnUser: invoice.user,
              module: MODULE_NAME, method: 'chargeInvoices',
              message: `Invoice is too new - Operation has been skipped - '${invoice.id}'`
            });
            continue;
          }
          const newInvoice = await this.chargeInvoice(invoice);
          if (this.isInvoiceOutOfPaginationScope(newInvoice, taskConfig)) {
            // The new invoice may now have a different status - and this impacts the pagination
            skip--; // This is very important!
          }
          await Logging.logInfo({
            tenantID: this.tenant.id,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: invoice.user,
            module: MODULE_NAME, method: 'chargeInvoices',
            message: `Successfully charged invoice '${invoice.id}'`
          });
          actionsDone.inSuccess++;
        } catch (error) {
          actionsDone.inError++;
          await Logging.logError({
            tenantID: this.tenant.id,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: invoice.user,
            module: MODULE_NAME, method: 'chargeInvoices',
            message: `Failed to charge invoice '${invoice.id}'`,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
    return actionsDone;
  }

  public async sendInvoiceNotification(billingInvoice: BillingInvoice): Promise<boolean> {
    try {
      // Do not send notifications for invoices that are not yet finalized!
      if (billingInvoice.status === BillingInvoiceStatus.OPEN || billingInvoice.status === BillingInvoiceStatus.PAID) {
        // Send link to the user using our notification framework (link to the front-end + download)
        const user = await UserStorage.getUser(this.tenant, billingInvoice.userID);
        // Stripe saves amount in cents
        const invoiceAmountAsDecimal = new Decimal(billingInvoice.amount).div(100);
        // Format amount with currency symbol depending on locale
        const invoiceAmount = new Intl.NumberFormat(Utils.convertLocaleForCurrency(user.locale), { style: 'currency', currency: billingInvoice.currency.toUpperCase() }).format(invoiceAmountAsDecimal.toNumber());
        // Send async notification
        NotificationHandler.sendBillingNewInvoiceNotification(
          this.tenant,
          billingInvoice.id,
          user,
          {
            user,
            evseDashboardInvoiceURL: Utils.buildEvseBillingInvoicesURL(this.tenant.subdomain),
            evseDashboardURL: Utils.buildEvseURL(this.tenant.subdomain),
            invoiceDownloadUrl: Utils.buildEvseBillingDownloadInvoicesURL(this.tenant.subdomain, billingInvoice.id),
            // Empty url allows to decide wether to display "pay" button in the email
            payInvoiceUrl: billingInvoice.status === BillingInvoiceStatus.OPEN ? billingInvoice.payInvoiceUrl : '',
            invoiceAmount: invoiceAmount,
            invoiceNumber: billingInvoice.number,
            invoiceStatus: billingInvoice.status,
          }
        ).catch((error) => {
          Logging.logPromiseError(error, this.tenant?.id);
        });
        // Needed only for testing
        return true;
      }
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TRANSACTION,
        actionOnUser: billingInvoice.user,
        module: MODULE_NAME, method: 'sendInvoiceNotification',
        message: `Failed to send notification for invoice '${billingInvoice.id}'`,
        detailedMessages: { error: error.stack }
      });
      return false;
    }
  }

  public checkBillTransaction(transaction: Transaction): void {
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User is not provided',
        module: MODULE_NAME,
        method: 'checkBillTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Charging Station
    if (!transaction.chargeBox) {
      throw new BackendError({
        message: 'Charging Station is not provided',
        module: MODULE_NAME,
        method: 'checkBillTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Billing Data
    if (!transaction.user?.billingData?.customerID) {
      throw new BackendError({
        message: 'User has no Billing Data',
        module: MODULE_NAME,
        method: 'checkBillTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
  }

  public checkStartTransaction(transaction: Transaction, chargingStation: ChargingStation, siteArea: SiteArea): boolean {
    if (!this.settings.billing.isTransactionBillingActivated) {
      return false;
    }
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User ID is not provided',
        module: MODULE_NAME,
        method: 'checkStartTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Free Access
    if (transaction.user.freeAccess) {
      return false;
    }
    if (!chargingStation) {
      throw new BackendError({
        message: 'The Charging Station is mandatory to start a Transaction',
        module: MODULE_NAME,
        method: 'checkStartTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    if (Utils.isTenantComponentActive(this.tenant, TenantComponents.ORGANIZATION)) {
      // Check for the Site Area
      if (!siteArea) {
        throw new BackendError({
          message: 'The Site Area is mandatory to start a Transaction',
          module: MODULE_NAME,
          method: 'checkStartTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
      if (!siteArea.accessControl) {
        return false;
      }
    }
    // Check Billing Data
    if (!transaction.user?.billingData?.customerID) {
      throw new BackendError({
        message: 'User has no Billing data or no Customer ID',
        module: MODULE_NAME,
        method: 'checkStartTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    return true;
  }

  protected async updateTransactionsBillingData(billingInvoice: BillingInvoice): Promise<void> {
    if (!billingInvoice.sessions) {
      // This should not happen - but it happened once!
      throw new Error(`Unexpected situation - Invoice ID '${billingInvoice.id}' has no sessions attached to it`);
    }
    await Promise.all(billingInvoice.sessions.map(async (session) => {
      const transactionID = session.transactionID;
      try {
        const transaction = await TransactionStorage.getTransaction(this.tenant, Number(transactionID));
        // Update Billing Data
        if (transaction?.billingData?.stop) {
          transaction.billingData.stop.invoiceStatus = billingInvoice.status;
          transaction.billingData.stop.invoiceNumber = billingInvoice.number;
          transaction.billingData.lastUpdate = new Date();
          // Save
          await TransactionStorage.saveTransactionBillingData(this.tenant, transaction.id, transaction.billingData);
        }
      } catch (error) {
        // Catch stripe errors and send the information back to the client
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_CHARGE_INVOICE,
          actionOnUser: billingInvoice.user,
          module: MODULE_NAME, method: 'updateTransactionsBillingData',
          message: `Failed to update Transaction Billing data of Transaction ID '${transactionID}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }));
  }

  protected async checkBillingDataThreshold(transaction: Transaction): Promise<boolean> {
    // Do not bill suspicious StopTransaction events
    if (!Utils.isDevelopmentEnv()) {
      const timeSpent = this.computeTimeSpentInSeconds(transaction);
      if (timeSpent < Constants.AFIREV_MINIMAL_DURATION_THRESHOLD /* 2 minutes */) {
        await Logging.logWarning({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: this.tenant.id,
          user: transaction.userID,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'stopTransaction',
          message: `Transaction duration is too short - billing operation has been aborted - transaction ID: ${transaction.id}`,
        });
        // Abort the billing process - thresholds are not met!
        return false;
      }
      if (transaction.stop.totalConsumptionWh < Constants.AFIREV_MINIMAL_CONSUMPTION_THRESHOLD /* 0.5 kW.h */) {
        await Logging.logWarning({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: this.tenant.id,
          user: transaction.userID,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'stopTransaction',
          message: `Transaction consumption is too low - billing operation has been aborted - transaction ID: ${transaction.id}`,
        });
        // Abort the billing process - thresholds are not met!
        return false;
      }
    }
    // Session data seem to be consistent
    return true;
  }

  protected convertTimeSpentToString(transaction: Transaction): string {
    const totalDuration = this.computeTimeSpentInSeconds(transaction);
    return moment.duration(totalDuration, 's').format('h[h]mm', { trim: false });
  }

  protected computeTimeSpentInSeconds(transaction: Transaction): number {
    let totalDuration: number;
    if (!transaction.stop) {
      totalDuration = moment.duration(moment(transaction.lastConsumption.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    } else {
      totalDuration = moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    }
    return totalDuration;
  }

  protected async retrieveAccountData(transaction: Transaction) : Promise<BillingSessionAccountData> {
    if (Utils.isTenantComponentActive(this.tenant, TenantComponents.BILLING_PLATFORM)) {
      const site = await SiteStorage.getSite(this.tenant, transaction.siteID, { withCompany: true });
      let accountData = site.accountData;
      if (!accountData?.accountID) {
        accountData = site.company?.accountData;
      }
      if (accountData?.accountID) {
        return {
          withTransferActive: true,
          accountID: accountData.accountID,
          platformFeeStrategy: accountData.platformFeeStrategy
        };
      }
    }
    return null;
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

  // eslint-disable-next-line @typescript-eslint/member-ordering
  public async clearTestData(): Promise<void> {
    // await this.checkConnection(); - stripe connection is useless to cleanup test data
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.BILLING_TEST_DATA_CLEANUP,
      module: MODULE_NAME, method: 'clearTestData',
      message: 'Starting test data cleanup'
    });
    await this.clearAllInvoiceTestData();
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.BILLING_TEST_DATA_CLEANUP,
      module: MODULE_NAME, method: 'clearTestData',
      message: 'Invoice Test data cleanup has been completed'
    });
    await this.clearAllUsersTestData();
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.BILLING_TEST_DATA_CLEANUP,
      module: MODULE_NAME, method: 'clearTestData',
      message: 'User Test data cleanup has been completed'
    });
  }

  private async clearAllInvoiceTestData(): Promise<void> {
    const invoices: DataResult<BillingInvoice> = await BillingStorage.getInvoices(this.tenant, { liveMode: false }, Constants.DB_PARAMS_MAX_LIMIT);
    // Let's now finalize all invoices and attempt to get it paid
    for (const invoice of invoices.result) {
      try {
        await this.clearInvoiceTestData(invoice);
        await Logging.logInfo({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: invoice.user,
          module: MODULE_NAME, method: 'clearAllInvoiceTestData',
          message: `Successfully clear test data for invoice '${invoice.id}'`
        });
      } catch (error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: invoice.user,
          module: MODULE_NAME, method: 'clearAllInvoiceTestData',
          message: `Failed to clear invoice test data - Invoice: '${invoice.id}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private async clearInvoiceTestData(billingInvoice: BillingInvoice): Promise<void> {
    if (billingInvoice.liveMode) {
      throw new BackendError({
        message: 'Unexpected situation - Attempt to clear an invoice with live Billing data',
        module: MODULE_NAME,
        method: 'clearInvoiceTestData',
        action: ServerAction.BILLING_TEST_DATA_CLEANUP
      });
    }
    await this.clearTransactionsTestData(billingInvoice);
    await BillingStorage.deleteInvoice(this.tenant, billingInvoice.id);
  }

  private async clearTransactionsTestData(billingInvoice: BillingInvoice): Promise<void> {
    await Promise.all(billingInvoice.sessions.map(async (session) => {
      const transactionID = session.transactionID;
      try {
        const transaction = await TransactionStorage.getTransaction(this.tenant, Number(transactionID));
        // Update Billing Data
        const stop: BillingDataTransactionStop = {
          status: BillingStatus.UNBILLED,
          invoiceID: null,
          invoiceNumber: null,
          invoiceStatus: null
        };
        transaction.billingData = {
          withBillingActive: false,
          lastUpdate:new Date(),
          stop
        };
        // Save to clear billing data
        await TransactionStorage.saveTransactionBillingData(this.tenant, transaction.id, transaction.billingData);
      } catch (error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          module: MODULE_NAME, method: 'clearTransactionsTestData',
          message: 'Failed to clear transaction Billing data',
          detailedMessages: { error: error.stack }
        });
      }
    }));
  }

  private async clearAllUsersTestData(): Promise<void> {
    const users: User[] = await this.getUsersWithTestBillingData();
    // Let's now finalize all invoices and attempt to get it paid
    for (const user of users) {
      try {
        await this.clearUserTestBillingData(user);
        await Logging.logInfo({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: user,
          module: MODULE_NAME, method: 'clearAllUsersTestData',
          message: `Successfully cleared user test data for Invoice of User ID '${user.id}'`
        });
      } catch (error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: user,
          module: MODULE_NAME, method: 'clearAllUsersTestData',
          message: `Failed to clear user test data - User: '${user.id}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private async getUsersWithTestBillingData(): Promise<User[]> {
    // Get the users where billingData.liveMode is set to false
    const users = await UserStorage.getUsers(this.tenant,
      {
        statuses: [UserStatus.ACTIVE],
        withTestBillingData: true
      }, Constants.DB_PARAMS_MAX_LIMIT);
    if (users.count > 0) {
      return users.result;
    }
    return [];
  }

  private async clearUserTestBillingData(user: User): Promise<void> {
    if (user?.billingData?.liveMode) {
      throw new BackendError({
        message: 'Unexpected situation - Attempt to clear an User with live Billing data',
        module: MODULE_NAME,
        method: 'clearUserTestBillingData',
        action: ServerAction.BILLING_TEST_DATA_CLEANUP
      });
    }
    // Let's remove the billingData field
    await UserStorage.saveUserBillingData(this.tenant, user.id, null);
  }

  private isInvoiceInPaginationScope(invoice: BillingInvoice, taskConfig: BillingPeriodicOperationTaskConfig): boolean {
    if (taskConfig.onlyProcessUnpaidInvoices) {
      if (invoice.status === BillingInvoiceStatus.OPEN) {
        return true;
      }
    } else if (invoice.status === BillingInvoiceStatus.DRAFT) {
      return true;
    }
    return false;
  }

  private isInvoiceOutOfPaginationScope(invoice: BillingInvoice, taskConfig: BillingPeriodicOperationTaskConfig): boolean {
    return !this.isInvoiceInPaginationScope(invoice, taskConfig);
  }

  private preparePeriodicBillingQueryParameters(forceOperation: boolean): { limit: number, sort: Record<string, unknown>, filter: Record<string, unknown> } {
    if (!this.settings.billing?.periodicBillingAllowed) {
      // Nothing to do - periodic billing is OFF
      return null;
    }
    // Prepare filtering to process Invoices of the previous month
    let startDateTime: Date, endDateTime: Date, limit: number;
    if (forceOperation) {
      // Only used when running tests
      limit = 1; // Specific limit to test the pagination
      startDateTime = moment().startOf('day').toDate(); // Today at 00:00:00 (AM)
      endDateTime = moment().endOf('day').toDate(); // Today at 23:59:59 (PM)
    } else {
      // Used once a month
      limit = Constants.BATCH_PAGE_SIZE;
      startDateTime = moment().date(0).date(1).startOf('day').toDate(); // 1st day of the previous month 00:00:00 (AM)
      endDateTime = moment().date(1).startOf('day').toDate(); // 1st day of this month 00:00:00 (AM)
    }
    // Filter the invoice status based on the billing settings
    const invoiceStatus = [ BillingInvoiceStatus.DRAFT ];
    // Now return the query parameters
    return {
      // --------------------------------------------------------------------------------
      // ACHTUNG!!! Make sure to adapt the paging logic when the data used for filtering
      // is also updated by the periodic operation
      // --------------------------------------------------------------------------------
      filter: {
        startDateTime,
        endDateTime,
        invoiceStatus
      },
      limit,
      sort: { createdOn: 1 } // Sort by creation date - process the eldest first!
    };
  }

  private prepareRetryPaymentQueryParameters(forceOperation: boolean): { limit: number, sort: Record<string, unknown>, filter: Record<string, unknown> } {
    // Prepare filtering to process Invoices of the previous month
    let startDateTime: Date, endDateTime: Date, limit: number;
    if (forceOperation) {
      // Only used when running tests
      limit = 1; // Specific limit to test the pagination
      startDateTime = moment().startOf('day').toDate(); // Today at 00:00:00 (AM)
      endDateTime = moment().endOf('day').toDate(); // Today at 23:59:59 (PM)
    } else {
      // Used once a month
      limit = Constants.BATCH_PAGE_SIZE;
      startDateTime = moment().date(1).startOf('day').toDate(); // 1st day of this month 00:00:00 (AM)
      endDateTime = moment().add(-1,'days').endOf('day').toDate(); // yesterday at midnight
    }
    // Filter the invoice status based on the billing settings
    const invoiceStatus = [ BillingInvoiceStatus.OPEN ];
    // Now return the query parameters
    return {
      // --------------------------------------------------------------------------------
      // ACHTUNG!!! Make sure to adapt the paging logic when the data used for filtering
      // is also updated by the periodic operation
      // --------------------------------------------------------------------------------
      filter: {
        startDateTime,
        endDateTime,
        invoiceStatus
      },
      limit,
      sort: { createdOn: 1 } // Sort by creation date - process the eldest first!
    };
  }

  public abstract checkConnection(): Promise<void>;

  public abstract checkActivationPrerequisites(): Promise<void>;

  public abstract checkTestDataCleanupPrerequisites() : Promise<void>;

  public abstract resetConnectionSettings() : Promise<BillingSettings>;

  public abstract startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart>;

  public abstract updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate>;

  public abstract stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  public abstract endTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  public abstract billTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  public abstract checkIfUserCanBeCreated(user: User): Promise<boolean>;

  public abstract checkIfUserCanBeUpdated(user: User): Promise<boolean>;

  public abstract checkIfUserCanBeDeleted(user: User): Promise<boolean>;

  public abstract getUser(user: User): Promise<BillingUser>;

  public abstract createUser(user: User): Promise<BillingUser>;

  public abstract updateUser(user: User): Promise<BillingUser>;

  public abstract repairUser(user: User): Promise<BillingUser>;

  public abstract deleteUser(user: User): Promise<void>;

  public abstract getTaxes(): Promise<BillingTax[]>;

  public abstract billInvoiceItem(user: User, billingInvoiceItems: BillingInvoiceItem): Promise<BillingInvoice>;

  public abstract downloadInvoiceDocument(invoice: BillingInvoice): Promise<Buffer>;

  public abstract downloadTransferInvoiceDocument(transfer: BillingTransfer): Promise<Buffer>;

  public abstract chargeInvoice(invoice: BillingInvoice): Promise<BillingInvoice>;

  public abstract consumeBillingEvent(req: Request): Promise<boolean>;

  public abstract setupPaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult>;

  public abstract getPaymentMethods(user: User): Promise<BillingPaymentMethod[]>;

  public abstract deletePaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult>;

  public abstract precheckStartTransactionPrerequisites(user: User): Promise<StartTransactionErrorCode[]>;

  public abstract createConnectedAccount(): Promise<Partial<BillingAccount>>;

  public abstract refreshConnectedAccount(billingAccount: BillingAccount, url: string): Promise<Partial<BillingAccount>>;

  public abstract billPlatformFee(transfer: BillingTransfer, user: User, billingAccount: BillingAccount): Promise<BillingPlatformInvoice>;

  public abstract sendTransfer(transfer: BillingTransfer, user: User): Promise<string>;

  public async isUserSynchronized(user: User): Promise<boolean> {
    // Make sure to get fresh data
    user = await UserStorage.getUser(this.tenant, user.id);
    const customerID: string = user?.billingData?.customerID;
    // returns true when the customerID is properly set!
    return !!customerID;
  }

  public async dispatchCollectedFunds(taskConfig: DispatchFundsTaskConfig): Promise<ActionsResponse> {
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    if (taskConfig?.forceOperation && Utils.isDevelopmentEnv()) {
      Logging.logConsoleDebug('Funds dispatching is being forced for testing purposes reasons!');
    }
    const collectedFunds = await TransactionStorage.getCollectedFunds(this.tenant);
    if (collectedFunds.count) {
      for (const collectedFundReport of collectedFunds.result) {
        try {
          await this.dispatchCollectedFundsToAccount(collectedFundReport);
          // successfully dispatched funds to the account
          actionsDone.inSuccess++;
        } catch (error) {
          actionsDone.inError++;
          await Logging.logError({
            tenantID: this.tenant.id,
            action: ServerAction.BILLING_TRANSFER_DISPATCH_FUNDS,
            module: MODULE_NAME, method: 'dispatchCollectedFunds',
            message: `Failed to dispatch funds to account ID: '${collectedFundReport.key?.accountID}'`,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
    return actionsDone;
  }

  public async dispatchCollectedFundsToAccount(collectedFundReport: CollectedFundReport): Promise<void> {
    const accountID = collectedFundReport.key.accountID;
    const currency = collectedFundReport.key.currency;

    const nbTransactions = collectedFundReport.transactionIDs.length;
    if (nbTransactions) {
      const lock = await LockingHelper.acquireDispatchCollectedFundsToAccountLock(this.tenant.id, accountID);
      if (lock) {
        try {
          const transfer = await this.getDraftTransferForAccount(accountID, currency);
          const collectedFunds = Utils.createDecimal(transfer.collectedFunds).plus(collectedFundReport.collectedFunds).toNumber();
          const collectedFees = Utils.createDecimal(transfer.collectedFees).plus(collectedFundReport.collectedFees).toNumber();
          const sessionCounter = transfer.sessionCounter + nbTransactions;
          const transferToSave: BillingTransfer = {
            ...transfer,
            collectedFunds,
            collectedFees,
            sessionCounter,
          };
          const transferID = await BillingStorage.saveTransfer(this.tenant, transferToSave);
          await TransactionStorage.updateTransactionsWithTransferData(this.tenant, collectedFundReport.transactionIDs, transferID);
          await Logging.logInfo({
            tenantID: this.tenant.id,
            action: ServerAction.BILLING_TRANSFER_DISPATCH_FUNDS,
            module: MODULE_NAME, method: 'dispatchCollectedFunds',
            message: `Funds dispatched - account ID: '${collectedFundReport.key?.accountID}' - Collected funds: ${collectedFunds} - Collected fees: ${collectedFees}`,
          });
        } finally {
          // Release the lock
          await LockingManager.release(lock);
        }
      } else {
        // Lock couldn't be acquired
        // We do not mind - Operation will be tried again on the next job execution
      }
    }
  }

  private async getDraftTransferForAccount(accountID: string, currency: string) : Promise<BillingTransfer> {
    const filter = {
      // TODO - add filtering on the dates - we should have a transfer per month !?!
      // TODO - filter on the currency as well?
      accountIDs: [accountID],
      status: [BillingTransferStatus.DRAFT],
    };
    const sort = { createdOn: -1 };
    const transfers = await BillingStorage.getTransfers(this.tenant, filter, { skip: 0, limit: 1, sort });
    const transfer = transfers.result[0];
    // Return the existing DRAFT transfer or a new one!
    return (transfer) ? transfer : {
      accountID, status: BillingTransferStatus.DRAFT, sessionCounter: 0,
      collectedFunds: 0, collectedFlatFees: 0, collectedFees: 0, totalConsumptionWh: 0, totalDurationSecs: 0, transferAmount: 0,
      platformFeeData: null, transferExternalID: null,
      currency: currency,
      createdBy: null,
      createdOn: new Date()
    };
  }

  protected computeAccountSessionFee(platformFeeStrategy: BillingPlatformFeeStrategy, sessionTotalAmount: number): number {
    const { percentage, flatFeePerSession } = platformFeeStrategy;
    const feeAmountAsDecimal = Utils.createDecimal(sessionTotalAmount).mul(percentage).div(100).plus(flatFeePerSession);
    const feeAmount = Utils.roundTo(feeAmountAsDecimal, 2);
    return feeAmount;
  }
}
