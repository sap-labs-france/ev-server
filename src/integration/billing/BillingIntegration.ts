import BackendError from '../../exception/BackendError';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import { BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceItem, BillingTax, BillingUser, BillingUserSynchronizeAction } from '../../types/Billing';
import { UserInErrorType } from '../../types/InError';
import { ServerAction } from '../../types/Server';
import { BillingSetting } from '../../types/Setting';
import Transaction from '../../types/Transaction';
import User, { UserStatus } from '../../types/User';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import BillingStorage from '../../storage/mongodb/BillingStorage';

const MODULE_NAME = 'Billing';

export default abstract class BillingIntegration<T extends BillingSetting> {
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
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
            action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
            action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
            action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
            action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
            action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
            action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          module: MODULE_NAME, method: 'synchronizeUsers',
          message: `${actionsDone.inSuccess} user(s) were successfully synchronized`
        });
      }
      if (actionsDone.inError > 0) {
        Logging.logError({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          module: MODULE_NAME, method: 'synchronizeUsers',
          message: `Synchronization failed with ${actionsDone.inError} errors. Check your Billing system's logs.`
        });
      }
    } else {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
        module: MODULE_NAME, method: 'synchronizeUsers',
        message: 'All the users are up to date'
      });
    }
    // Update last synchronization
    const billingSettings = await SettingStorage.getBillingSettings(tenantID);
    billingSettings.stripe.usersLastSynchronizedOn = new Date();
    await SettingStorage.saveBillingSettings(tenantID, billingSettings);
    // Result
    return actionsDone;
  }

  public async synchronizeUser(user: User, tenantID) {
    try {
      const exists = await this.userExists(user);
      let newUser: BillingUser;
      if (!exists) {
        newUser = await this.createUser(user);
      } else {
        newUser = await this.updateUser(user);
      }
      try {
        await UserStorage.saveUserBillingData(tenantID, user.id, newUser.billingData);
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeUser',
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          actionOnUser: user,
          message: 'Unable to save user Billing Data in e-Mobility',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'synchronizeUser',
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
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
      const newUser = await this.createUser(user);
      try {
        await UserStorage.saveUserBillingData(tenantID, user.id, newUser.billingData);
        Logging.logInfo({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          actionOnUser: user,
          module: MODULE_NAME, method: 'forceSynchronizeUser',
          message: `Successfully forced the synchronization of the user '${user.email}'`,
        });
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'forceSynchronizeUser',
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          actionOnUser: user,
          message: 'Unable to save user Billing Data in e-Mobility',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
        actionOnUser: user,
        message: `Cannot force synchronize user '${user.email}' with billing system`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public async synchronizeInvoices(tenantID: string, billingUser?: BillingUser) {
    if (billingUser && (!billingUser.billingData || !billingUser.billingData.customerID)) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'User has no Billing data'
      });
    }
    this.checkConnection();
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    // Get recently updated invoices from Billing application
    let invoiceBillingIDsChangedInBilling: string[];
    if (billingUser) {
      const user = await UserStorage.getUserByBillingID(tenantID, billingUser.billingData.customerID);
      if (!user) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          message: 'User does not exists in e-Mobility'
        });
      }
      billingUser.billingData = user.billingData;
      invoiceBillingIDsChangedInBilling = await this.getUpdatedInvoiceIDsInBilling(billingUser);
    } else {
      invoiceBillingIDsChangedInBilling = await this.getUpdatedInvoiceIDsInBilling();
    }
    if (invoiceBillingIDsChangedInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        message: `${invoiceBillingIDsChangedInBilling.length} billing invoice(s) are going to be synchronized with e-Mobility invoices`
      });
    }
    for (const invoiceBillingIDChangedInBilling of invoiceBillingIDsChangedInBilling) {
      // Get updated billing invoice
      const invoiceBilling = await this.getInvoice(invoiceBillingIDChangedInBilling);
      if (!invoiceBilling) {
        actionsDone.inError++;
        Logging.logError({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          message: `Billing invoice with ID '${invoiceBillingIDChangedInBilling}' does not exist in Billing system`
        });
        continue;
      }
      // Get e-Mobility invoice
      const invoice = (await BillingStorage.getInvoices(tenantID, { invoiceID: invoiceBilling.invoiceID }, Constants.DB_PARAMS_SINGLE_RECORD)).result[0];
      if (invoice) {
        // If invoice already exists, set back its e-Mobility ID before saving
        invoiceBilling.id = invoice.id;
      } else {
        // Associate e-Mobility user to invoice according to invoice customer ID
        try {
          const user = await UserStorage.getUserByBillingID(tenantID, invoiceBilling.customerID);
          invoiceBilling.userID = user ? user.id : null;
        } catch (error) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME, method: 'synchronizeInvoices',
            action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
            message: 'Unable to retrieve user in e-Mobility',
            detailedMessages: { error: error.message, stack: error.stack }
          });
        }
      }
      try {
        await BillingStorage.saveInvoice(tenantID, invoiceBilling);
        Logging.logInfo({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          message: 'Successfully synchronized invoice',
        });
        actionsDone.inSuccess++;
      } catch (error) {
        actionsDone.inError++;
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          message: 'Unable to save Billing invoice in e-Mobility',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    if (actionsDone.inSuccess || actionsDone.inError) {
      if (actionsDone.inSuccess > 0) {
        Logging.logInfo({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          message: `${actionsDone.inSuccess} invoice(s) were successfully synchronized`
        });
      }
      if (actionsDone.inError > 0) {
        Logging.logError({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          message: `Synchronization failed with ${actionsDone.inError} errors. Check your Billing system's logs.`
        });
      }
    } else {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        message: 'All the invoices are up to date'
      });
    }
    if (billingUser) {
      // Update user last synchronization
      const user = await UserStorage.getUserByBillingID(tenantID, billingUser.billingData.customerID);
      user.billingData.invoicesLastSynchronizedOn = new Date();
      if (!user) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          message: 'User does not exists in e-Mobility',
        });
      }
      try {
        await UserStorage.saveUserBillingData(tenantID, user.id, user.billingData);
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeInvoices',
          action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
          message: 'Unable to save user Billing data',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    } else {
      // Update global last synchronization
      const billingSettings = await SettingStorage.getBillingSettings(tenantID);
      billingSettings.stripe.invoicesLastSynchronizedOn = new Date();
      await SettingStorage.saveBillingSettings(tenantID, billingSettings);
    }
    return actionsDone;
  }

  async abstract checkConnection();

  async abstract getUpdatedUserIDsInBilling(): Promise<string[]>;

  async abstract startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart>;

  async abstract updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate>;

  async abstract stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  async abstract checkIfUserCanBeCreated(user: User): Promise<boolean>;

  async abstract checkIfUserCanBeUpdated(user: User): Promise<boolean>;

  async abstract checkIfUserCanBeDeleted(user: User): Promise<boolean>;

  async abstract getUser(id: string): Promise<BillingUser>;

  async abstract getUserByEmail(email: string): Promise<BillingUser>;

  async abstract getUsers(): Promise<BillingUser[]>;

  async abstract createUser(user: User): Promise<BillingUser>;

  async abstract updateUser(user: User): Promise<BillingUser>;

  async abstract deleteUser(user: User);

  async abstract userExists(user: User): Promise<boolean>;

  async abstract getTaxes(): Promise<BillingTax[]>;

  async abstract getInvoice(id: string): Promise<BillingInvoice>;

  async abstract getUpdatedInvoiceIDsInBilling(billingUser?: BillingUser): Promise<string[]>;

  async abstract createInvoiceItem(user: BillingUser, invoiceID: string, invoiceItem: BillingInvoiceItem, idempotencyKey?: string|number): Promise<BillingInvoiceItem>;

  async abstract createInvoice(user: BillingUser, invoiceItem: BillingInvoiceItem, idempotencyKey?: string|number): Promise<{ invoice: BillingInvoice; invoiceItem: BillingInvoiceItem }>;

  async abstract sendInvoiceToUser(invoice: BillingInvoice): Promise<BillingInvoice>;
}
