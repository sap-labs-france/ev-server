import BackendError from '../../exception/BackendError';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import { Action } from '../../types/Authorization';
import { BillingDataStart, BillingDataStop, BillingDataUpdate, BillingInvoice, HttpBillingInvoiceRequest, BillingInvoiceItem, BillingPartialUser, BillingTax, BillingUserData, BillingUserSynchronizeAction } from '../../types/Billing';
import { DataResult } from '../../types/DataResult';
import { UserInErrorType } from '../../types/InError';
import { BillingSetting } from '../../types/Setting';
import Transaction from '../../types/Transaction';
import User, { UserStatus } from '../../types/User';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';

const MODULE_NAME = 'Billing';

export default abstract class Billing<T extends BillingSetting> {
  protected readonly tenantID: string; // Assuming GUID or other string format ID
  protected settings: T;

  protected constructor(tenantID: string, settings: T) {
    this.tenantID = tenantID;
    this.settings = settings;
  }

  getSettings(): T {
    return this.settings;
  }

  public async synchronizeUsers(tenantID): Promise<BillingUserSynchronizeAction> {
    await this.checkConnection();
    // Check
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    // Get users already in Billing synchronization error
    const usersBillingInError = await UserStorage.getUsersInError(tenantID,
      { errorTypes: [UserInErrorType.FAILED_BILLING_SYNCHRO] }, Constants.DB_PARAMS_MAX_LIMIT);
    actionsDone.inError = usersBillingInError.result.length;
    // Sync e-Mobility New Users with no billing data + e-Mobility Users that have been updated after last sync
    const newUsersToSyncInBilling = await UserStorage.getUsers(tenantID,
      { 'statuses': [UserStatus.ACTIVE], 'notSynchronizedBillingData': true },
      { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
    if (newUsersToSyncInBilling.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_SYNCHRONIZE,
        module: MODULE_NAME, method: 'synchronizeUsers',
        message: `${newUsersToSyncInBilling.count} new e-Mobility user(s) are going to be synchronized in the billing system`
      });
      for (const user of newUsersToSyncInBilling.result) {
        // Synchronize user
        try {
          await this.synchronizeUser(user, tenantID);
          Logging.logInfo({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.BILLING_SYNCHRONIZE,
            module: MODULE_NAME, method: 'synchronizeUsers',
            message: 'Successfully synchronized in the billing system'
          });
          actionsDone.inSuccess++;
        } catch (error) {
          actionsDone.inError++;
          Logging.logError({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.BILLING_SYNCHRONIZE,
            module: MODULE_NAME, method: 'synchronizeUsers',
            message: 'Failed to synchronize in the billing system',
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }
    }
    // Get recently updated customers from Billing application
    const userBillingIDsChangedInBilling = await this.getUpdatedUserIDsInBilling();
    // Synchronize e-Mobility User's Billing data
    if (userBillingIDsChangedInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_SYNCHRONIZE,
        module: MODULE_NAME, method: 'synchronizeUsers',
        message: `${userBillingIDsChangedInBilling.length} billing user(s) are going to be synchronized with e-Mobility users`
      });
      for (const userBillingIDChangedInBilling of userBillingIDsChangedInBilling) {
        // Get e-Mobility User
        const user = await UserStorage.getUserByBillingID(tenantID, userBillingIDChangedInBilling);
        if (!user) {
          actionsDone.inError++;
          Logging.logError({
            tenantID: tenantID,
            source: Constants.CENTRAL_SERVER,
            action: Action.BILLING_SYNCHRONIZE,
            module: MODULE_NAME, method: 'synchronizeUsers',
            message: `Billing user with ID '${userBillingIDChangedInBilling}' does not exist in e-Mobility`
          });
          continue;
        }
        // Get Billing User
        const billingUser = await this.getUser(userBillingIDChangedInBilling);
        if (!billingUser) {
          // Only triggers an error if e-Mobility user is not deleted
          actionsDone.inError++;
          user.billingData.hasSynchroError = true;
          await UserStorage.saveUserBillingData(tenantID, user.id, user.billingData);
          Logging.logError({
            tenantID: tenantID,
            source: Constants.CENTRAL_SERVER,
            action: Action.BILLING_SYNCHRONIZE,
            actionOnUser: user,
            module: MODULE_NAME, method: 'synchronizeUsers',
            message: `Billing user with ID '${userBillingIDChangedInBilling}' does not exist in billing system`
          });
          continue;
        }
        // Synchronize several times the user in case of fail before setting it in error
        try {
          await this.synchronizeUser(user, tenantID);
          Logging.logInfo({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.BILLING_SYNCHRONIZE,
            module: MODULE_NAME, method: 'synchronizeUsers',
            message: 'Successfully synchronized in the billing system'
          });
          actionsDone.inSuccess++;
        } catch (error) {
          actionsDone.inError++;
          Logging.logError({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.BILLING_SYNCHRONIZE,
            module: MODULE_NAME, method: 'synchronizeUsers',
            message: 'Failed to synchronize in the billing system'
          });
        }
      }
    }
    // Log
    if (actionsDone.inSuccess || actionsDone.inError) {
      if (actionsDone.inSuccess > 0) {
        Logging.logInfo({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: Action.BILLING_SYNCHRONIZE,
          module: MODULE_NAME, method: 'synchronizeUsers',
          message: `${actionsDone.inSuccess} user(s) were successfully synchronized`
        });
      }
      if (actionsDone.inError > 0) {
        Logging.logError({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: Action.BILLING_SYNCHRONIZE,
          module: MODULE_NAME, method: 'synchronizeUsers',
          message: `Synchronization failed with ${actionsDone.inError} errors. Check your Billing system's logs.`
        });
      }
    } else {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_SYNCHRONIZE,
        module: MODULE_NAME, method: 'synchronizeUsers',
        message: 'All the users are up to date'
      });
    }
    // Update last synchronization
    const billingSettings = await SettingStorage.getBillingSettings(tenantID);
    billingSettings.stripe.lastSynchronizedOn = new Date();
    await SettingStorage.saveBillingSettings(tenantID, billingSettings);
    // Result
    return actionsDone;
  }

  public async synchronizeUser(user: User, tenantID) {
    try {
      const exists = await this.userExists(user);
      let newBillingData: BillingUserData;
      if (!exists) {
        newBillingData = await this.createUser(user);
      } else {
        newBillingData = await this.updateUser(user);
      }
      try {
        await UserStorage.saveUserBillingData(tenantID, user.id, newBillingData);
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeUser',
          action: Action.BILLING_SYNCHRONIZE,
          actionOnUser: user,
          message: 'Unable to save user Billing Data in e-Mobility',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    } catch (error) {
      if (!user.billingData) {
        user.billingData = {};
      }
      user.billingData.hasSynchroError = true;
      try {
        await UserStorage.saveUserBillingData(tenantID, user.id, user.billingData);
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeUser',
          action: Action.BILLING_SYNCHRONIZE,
          actionOnUser: user,
          message: 'Unable to save user Billing Data in e-Mobility',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'synchronizeUser',
        action: Action.BILLING_SYNCHRONIZE,
        actionOnUser: user,
        message: `Cannot synchronize user '${user.email}' with billing system`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public async forceSynchronizeUser(user: User, tenantID) {
    try {
      // Exists in Billing?
      const billingUser = await this.userExists(user);
      if (billingUser) {
        await this.deleteUser(user);
      }
      // Recreate the Billing user
      delete user.billingData;
      const newBillingData = await this.createUser(user);
      try {
        await UserStorage.saveUserBillingData(tenantID, user.id, newBillingData);
        Logging.logInfo({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: Action.BILLING_SYNCHRONIZE,
          actionOnUser: user,
          module: MODULE_NAME, method: 'forceSynchronizeUser',
          message: `Successfully forced the synchronization of the user '${user.email}'`,
        });
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'forceSynchronizeUser',
          action: Action.BILLING_SYNCHRONIZE,
          actionOnUser: user,
          message: 'Unable to save user Billing Data in e-Mobility',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        action: Action.BILLING_SYNCHRONIZE,
        actionOnUser: user,
        message: `Cannot force synchronize user '${user.email}' with billing system`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  async abstract checkConnection();

  async abstract getUpdatedUserIDsInBilling(): Promise<string[]>;

  async abstract startTransaction(transaction: Transaction): Promise<BillingDataStart>;

  async abstract updateTransaction(transaction: Transaction): Promise<BillingDataUpdate>;

  async abstract stopTransaction(transaction: Transaction): Promise<BillingDataStop>;

  async abstract checkIfUserCanBeCreated(user: User): Promise<boolean>;

  async abstract checkIfUserCanBeUpdated(user: User): Promise<boolean>;

  async abstract checkIfUserCanBeDeleted(user: User): Promise<boolean>;

  async abstract getUser(id: string): Promise<BillingPartialUser>;

  async abstract getUserByEmail(email: string): Promise<BillingPartialUser>;

  async abstract getUsers(): Promise<BillingPartialUser[]>;

  async abstract createUser(user: User): Promise<BillingUserData>;

  async abstract updateUser(user: User): Promise<BillingUserData>;

  async abstract deleteUser(user: User);

  async abstract userExists(user: User): Promise<boolean>;

  async abstract getTaxes(): Promise<BillingTax[]>;

  async abstract getUserInvoices(user: BillingPartialUser, filters?: HttpBillingInvoiceRequest): Promise<DataResult<BillingInvoice>>;

  async abstract getUserInvoice(user: BillingPartialUser, invoiceId: string): Promise<BillingInvoice>;

  async abstract getOpenedInvoice(user: BillingPartialUser): Promise<BillingInvoice>;

  async abstract createInvoiceItem(user: BillingPartialUser, invoice: BillingInvoice, invoiceItem: BillingInvoiceItem): Promise<BillingInvoiceItem>;

  async abstract createInvoice(user: BillingPartialUser, invoiceItem: BillingInvoiceItem): Promise<{ invoice: BillingInvoice; invoiceItem: BillingInvoiceItem }>;

  async abstract sendInvoiceToUser(invoiceId: string): Promise<BillingInvoice>;
}
