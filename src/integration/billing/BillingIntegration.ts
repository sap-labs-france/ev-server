import { BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceItem, BillingTax, BillingUser, BillingUserSynchronizeAction } from '../../types/Billing';
import User, { UserStatus } from '../../types/User';
import { ActionsResponse } from '../../types/GlobalType';
import BackendError from '../../exception/BackendError';
import { BillingSetting } from '../../types/Setting';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Transaction from '../../types/Transaction';
import { UserInErrorType } from '../../types/InError';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'BillingIntegration';

export default abstract class BillingIntegration<T extends BillingSetting> {
  protected readonly tenantID: string; // Assuming GUID or other string format ID
  protected settings: T;

  protected constructor(tenantID: string, settings: T) {
    this.tenantID = tenantID;
    this.settings = settings;
  }

  public async synchronizeUsers(tenantID: string): Promise<BillingUserSynchronizeAction> {
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
    Utils.logActionsResponse(tenantID, ServerAction.BILLING_SYNCHRONIZE_USERS,
      MODULE_NAME, 'synchronizeUsers', actionsDone,
      '{{inSuccess}} user(s) were successfully synchronized',
      '{{inError}} user(s) failed to be synchronized',
      '{{inSuccess}} user(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the users are up to date'
    );
    // Update last synchronization
    const billingSettings = await SettingStorage.getBillingSettings(tenantID);
    billingSettings.stripe.usersLastSynchronizedOn = new Date();
    await SettingStorage.saveBillingSettings(tenantID, billingSettings);
    // Result
    return actionsDone;
  }

  public async synchronizeUser(user: User, tenantID: string): Promise<void> {
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
      } catch (error2) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'synchronizeUser',
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          actionOnUser: user,
          message: 'Unable to save user Billing Data in e-Mobility',
          detailedMessages: { error: error2.message, stack: error2.stack }
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

  public async forceSynchronizeUser(user: User, tenantID: string): Promise<void> {
    let billingUser: BillingUser;
    try {
      billingUser = await this.getUserByEmail(user.email);
      if (billingUser) {
        if (user.billingData) {
          // Only override user's customerID
          user.billingData.customerID = billingUser.billingData.customerID;
          user.billingData.hasSynchroError = false;
        } else {
          billingUser = await this.updateUser(user);
          user.billingData = billingUser.billingData;
        }
      } else {
        user.billingData = (await this.createUser(user)).billingData;
      }
      await UserStorage.saveUserBillingData(tenantID, user.id, user.billingData);
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        actionOnUser: user,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        message: `Successfully forced the synchronization of the user '${user.email}'`,
      });
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        actionOnUser: user,
        message: `Cannot force synchronize user '${user.email}' with billing system`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }

    // Synchronize user's invoices
    try {
      await this.synchronizeInvoices(this.tenantID, user);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        actionOnUser: user,
        message: `Cannot force synchronize invoices for user '${user.email}'`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public async forceSynchronizeUserInvoices(tenantID: string, user: User): Promise<ActionsResponse> {
    let billingUser: BillingUser = null;
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    await this.checkConnection();
    // Check billing user
    billingUser = await this.checkAndGetBillingUser(user);
    // Get all user invoices from Billing application
    // TODO: retrieve all the invoices 100 by 100
    const invoiceIDsInBilling = await this.getUpdatedInvoiceIDsInBilling(billingUser);
    if (invoiceIDsInBilling && invoiceIDsInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        user: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER_INVOICES,
        module: MODULE_NAME, method: 'forceSynchronizeUserInvoices',
        message: `${invoiceIDsInBilling.length} billing invoice(s) are going to be synchronized with e-Mobility invoices`
      });
      for (const invoiceIDInBilling of invoiceIDsInBilling) {
        try {
          // Get billing invoice
          const invoiceBilling = await this.getInvoice(invoiceIDInBilling);
          // Get e-Mobility invoice
          const invoice = await BillingStorage.getInvoiceByBillingInvoiceID(tenantID, invoiceIDInBilling);
          if (!invoiceBilling && !invoice) {
            actionsDone.inError++;
            Logging.logError({
              tenantID: tenantID,
              user: user,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER_INVOICES,
              module: MODULE_NAME, method: 'forceSynchronizeUserInvoices',
              message: `Billing invoice with ID '${invoiceIDInBilling}' does not exist anymore`
            });
            continue;
          }
          // Delete in e-Mobility
          if (!invoiceBilling && invoice) {
            await BillingStorage.deleteInvoiceByInvoiceID(tenantID, invoiceIDInBilling);
            Logging.logDebug({
              tenantID: tenantID,
              user: user,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER_INVOICES,
              module: MODULE_NAME, method: 'forceSynchronizeUserInvoices',
              message: `Billing invoice with ID '${invoiceIDInBilling}' has been deleted in e-Mobility`
            });
            actionsDone.inSuccess++;
            continue;
          }
          // Create / Update
          let userInInvoice: User;
          if (invoice) {
            // If invoice already exists, set back its e-Mobility ID before saving
            invoiceBilling.id = invoice.id;
          } else {
            // Associate e-Mobility user to invoice according to invoice customer ID
            if (user) {
              // Can only be the invoice of the user
              userInInvoice = user;
            } else {
              // Get user
              userInInvoice = await UserStorage.getUserByBillingID(tenantID, invoiceBilling.customerID);
            }
            Object.assign(invoiceBilling, { user: user });
          }
          await BillingStorage.saveInvoice(tenantID, invoiceBilling);
          Logging.logDebug({
            tenantID: tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER_INVOICES,
            module: MODULE_NAME, method: 'forceSynchronizeUserInvoices',
            message: `Invoice with ID '${invoiceIDInBilling}' has been ${invoice ? 'updated' : 'created'} in e-Mobility`,
            detailedMessages: { invoiceBilling }
          });
          if (userInInvoice) {
            userInInvoice.billingData.invoicesLastSynchronizedOn = new Date();
            await UserStorage.saveUserBillingData(tenantID, userInInvoice.id, userInInvoice.billingData);
          }
          actionsDone.inSuccess++;
        } catch (error) {
          actionsDone.inError++;
          Logging.logError({
            tenantID: tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER_INVOICES,
            module: MODULE_NAME, method: 'forceSynchronizeUserInvoices',
            message: `Unable to process the invoice with ID '${invoiceIDInBilling}'`,
            detailedMessages: { error: error.message, stack: error.stack, invoiceIDInBilling }
          });
        }
      }
    }
    // Log
    Utils.logActionsResponse(tenantID, ServerAction.BILLING_FORCE_SYNCHRONIZE_USER_INVOICES,
      MODULE_NAME, 'forceSynchronizeUserInvoices', actionsDone,
      '{{inSuccess}} invoice(s) were successfully synchronized',
      '{{inError}} invoice(s) failed to be synchronized',
      '{{inSuccess}} invoice(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the invoices are up to date'
    );
    return actionsDone;
  }

  public async synchronizeInvoices(tenantID: string, user?: User): Promise<BillingUserSynchronizeAction> {
    let billingUser: BillingUser = null;
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    await this.checkConnection();
    // Check billing user
    if (user) {
      billingUser = await this.checkAndGetBillingUser(user);
    }
    // Get recently updated invoices from Billing application
    let invoiceIDsInBilling: string[];
    if (billingUser) {
      billingUser.billingData = user.billingData;
      // Get user's invoices
      invoiceIDsInBilling = await this.getUpdatedInvoiceIDsInBilling(billingUser);
    } else {
      // Get all invoices
      invoiceIDsInBilling = await this.getUpdatedInvoiceIDsInBilling();
    }
    if (invoiceIDsInBilling && invoiceIDsInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        user: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        message: `${invoiceIDsInBilling.length} billing invoice(s) are going to be synchronized with e-Mobility invoices`
      });
      for (const invoiceIDInBilling of invoiceIDsInBilling) {
        try {
          // Get billing invoice
          const invoiceBilling = await this.getInvoice(invoiceIDInBilling);
          // Get e-Mobility invoice
          const invoice = await BillingStorage.getInvoiceByBillingInvoiceID(tenantID, invoiceIDInBilling);
          if (!invoiceBilling && !invoice) {
            actionsDone.inError++;
            Logging.logError({
              tenantID: tenantID,
              user: user,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
              module: MODULE_NAME, method: 'synchronizeInvoices',
              message: `Billing invoice with ID '${invoiceIDInBilling}' does not exist anymore`
            });
            continue;
          }
          // Delete in e-Mobility
          if (!invoiceBilling && invoice) {
            await BillingStorage.deleteInvoiceByInvoiceID(tenantID, invoiceIDInBilling);
            Logging.logDebug({
              tenantID: tenantID,
              user: user,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
              module: MODULE_NAME, method: 'synchronizeInvoices',
              message: `Billing invoice with ID '${invoiceIDInBilling}' has been deleted in e-Mobility`
            });
            actionsDone.inSuccess++;
            continue;
          }
          // Create / Update
          let userInInvoice: User;
          if (invoice) {
            // If invoice already exists, set back its e-Mobility ID before saving
            invoiceBilling.id = invoice.id;
          }
          // Associate e-Mobility user to invoice according to invoice customer ID
          if (user) {
            // Can only be the invoice of the user
            userInInvoice = user;
          } else {
            // Get user
            userInInvoice = await UserStorage.getUserByBillingID(tenantID, invoiceBilling.customerID);
          }
          invoiceBilling.user = userInInvoice ? userInInvoice : null;
          await BillingStorage.saveInvoice(tenantID, invoiceBilling);
          Logging.logDebug({
            tenantID: tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
            module: MODULE_NAME, method: 'synchronizeInvoices',
            message: `Invoice with ID '${invoiceIDInBilling}' has been ${invoice ? 'updated' : 'created'} in e-Mobility`,
            detailedMessages: { invoiceBilling }
          });
          if (userInInvoice) {
            userInInvoice.billingData.invoicesLastSynchronizedOn = new Date();
            await UserStorage.saveUserBillingData(tenantID, userInInvoice.id, userInInvoice.billingData);
          }
          actionsDone.inSuccess++;
        } catch (error) {
          actionsDone.inError++;
          Logging.logError({
            tenantID: tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
            module: MODULE_NAME, method: 'synchronizeInvoices',
            message: `Unable to process the invoice with ID '${invoiceIDInBilling}'`,
            detailedMessages: { error: error.message, stack: error.stack, invoiceIDInBilling }
          });
        }
      }
    }
    // Log
    Utils.logActionsResponse(tenantID, ServerAction.BILLING_SYNCHRONIZE_INVOICES,
      MODULE_NAME, 'synchronizeInvoices', actionsDone,
      '{{inSuccess}} invoice(s) were successfully synchronized',
      '{{inError}} invoice(s) failed to be synchronized',
      '{{inSuccess}} invoice(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the invoices are up to date'
    );
    if (!user) {
      // Update global last synchronization timestamp
      const billingSettings = await SettingStorage.getBillingSettings(tenantID);
      billingSettings.stripe.invoicesLastSynchronizedOn = new Date();
      await SettingStorage.saveBillingSettings(tenantID, billingSettings);
    }
    return actionsDone;
  }

  private async checkAndGetBillingUser(user: User): Promise<BillingUser> {
    const billingUser = await this.getUserByEmail(user.email);
    if (!billingUser) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        user: user,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'User does not exist in billing system',
        detailedMessages: { user, billingUser }
      });
    }
    // Check billing user data
    if (!billingUser.billingData || !billingUser.billingData.customerID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        user: user,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'User has no billing data in billing system',
        detailedMessages: { user, billingUser }
      });
    }
    if (!user.billingData || !user.billingData.customerID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        user: user,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'User has no billing data in e-Mobility',
        detailedMessages: { user, billingUser }
      });
    }
    if (user.billingData.customerID !== billingUser.billingData.customerID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        user: user,
        module: MODULE_NAME, method: 'synchronizeInvoices',
        action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
        message: 'User has not the billing data in e-Mobility and in the billing system',
        detailedMessages: { user, billingUser }
      });
    }
    return billingUser;
  }

  async abstract checkConnection(): Promise<void>;

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

  async abstract deleteUser(user: User): Promise<void>;

  async abstract userExists(user: User): Promise<boolean>;

  async abstract getTaxes(): Promise<BillingTax[]>;

  async abstract getInvoice(id: string): Promise<BillingInvoice>;

  async abstract getUpdatedInvoiceIDsInBilling(billingUser?: BillingUser): Promise<string[]>;

  async abstract createInvoiceItem(user: BillingUser, invoiceID: string, invoiceItem: BillingInvoiceItem, idempotencyKey?: string | number): Promise<BillingInvoiceItem>;

  async abstract createInvoice(user: BillingUser, invoiceItem: BillingInvoiceItem, idempotencyKey?: string | number): Promise<{ invoice: BillingInvoice; invoiceItem: BillingInvoiceItem }>;

  async abstract sendInvoiceToUser(invoice: BillingInvoice): Promise<BillingInvoice>;
}
