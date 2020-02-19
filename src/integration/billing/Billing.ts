import { BillingDataStart, BillingDataStop, BillingDataUpdate, BillingPartialUser, BillingTax, BillingUserData, BillingUserSynchronizeAction } from '../../types/Billing';
import User, { Status } from '../../types/User';
import { Action } from '../../types/Authorization';
import { BillingSetting } from '../../types/Setting';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Transaction from '../../types/Transaction';
import UserStorage from '../../storage/mongodb/UserStorage';
import { UserInErrorType } from '../../types/InError';

export default abstract class Billing<T extends BillingSetting> {

  // Protected because only used in subclasses at the moment
  private static MAX_RETRY_SYNCHRONIZATION = 3;
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
    // Check
    const actionsDone: BillingUserSynchronizeAction = {
      synchronized: 0,
      error: 0
    };
    // Get users already in Billing synchronization error
    const usersBillingInError = await UserStorage.getUsersInError(tenantID,
      { errorTypes: [UserInErrorType.FAILED_BILLING_SYNCHRO] }, Constants.DB_PARAMS_MAX_LIMIT);
    actionsDone.error = usersBillingInError.result.length;
    // Sync e-Mobility New Users with no billing data + e-Mobility Users that have been updated after last sync
    const newUsersToSyncInBilling = await UserStorage.getUsers(tenantID,
      { 'statuses': [Status.ACTIVE], 'notSynchronizedBillingData': true },
      { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
    if (newUsersToSyncInBilling.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        module: 'Billing', method: 'synchronizeUsers',
        message: `${newUsersToSyncInBilling.count} new e-Mobility user(s) are going to be synchronized in the billing system`
      });
      for (const user of newUsersToSyncInBilling.result) {
        // Synchronize user
        const action = await this.synchronizeUser(user, tenantID);
        // Stats
        if (action.synchronized > 0) {
          Logging.logInfo({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_BILLING,
            module: 'Billing', method: 'synchronizeUsers',
            message: `Successfully synchronized in the billing system`
          });
        } else {
          Logging.logError({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_BILLING,
            module: 'Billing', method: 'synchronizeUsers',
            message: `Failed to synchronize in the billing system`
          });
        }
        actionsDone.synchronized += action.synchronized;
        actionsDone.error += action.error;
      }
    }
    // Get recently updated customers from Billing application
    const userBillingIDsChangedInBilling = await this.getUpdatedUserIDsInBilling();
    // Synchronize e-Mobility User's Billing data
    if (userBillingIDsChangedInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        module: 'Billing', method: 'synchronizeUsers',
        message: `${userBillingIDsChangedInBilling.length} billing user(s) are going to be synchronized with e-Mobility users`
      });
      for (const userBillingIDChangedInBilling of userBillingIDsChangedInBilling) {
        // Get e-Mobility User
        const user = await UserStorage.getUserByBillingID(tenantID, userBillingIDChangedInBilling);
        if (!user) {
          actionsDone.error++;
          Logging.logError({
            tenantID: tenantID,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_BILLING,
            module: 'Billing', method: 'synchronizeUsers',
            message: `Billing user with ID '${userBillingIDChangedInBilling}' does not exist in e-Mobility`
          });
          continue;
        }
        // Get Billing User
        const billingUser = await this.getUser(userBillingIDChangedInBilling);
        if (!billingUser) {
          // Only triggers an error if e-Mobility user is not deleted
          actionsDone.error++;
          user.billingData.hasSynchroError = true;
          await UserStorage.saveUserBillingData(tenantID, user.id, user.billingData);
          Logging.logError({
            tenantID: tenantID,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_BILLING,
            actionOnUser: user,
            module: 'Billing', method: 'synchronizeUsers',
            message: `Billing user with ID '${userBillingIDChangedInBilling}' does not exist in billing system`
          });
          continue;
        }
        let nbTry = 0;
        let action = {} as BillingUserSynchronizeAction;
        // Synchronize several times the user in case of fail before setting it in error
        do {
          action = await this.synchronizeUser(user, tenantID);
          nbTry++;
        } while (nbTry < Billing.MAX_RETRY_SYNCHRONIZATION && action.synchronized === 0);
        if (action.synchronized > 0) {
          Logging.logInfo({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_BILLING,
            module: 'Billing', method: 'synchronizeUsers',
            message: `Successfully synchronized in the billing system`
          });
        } else {
          Logging.logError({
            tenantID: tenantID,
            actionOnUser: user,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_BILLING,
            module: 'Billing', method: 'synchronizeUsers',
            message: `Failed to synchronize in the billing system`
          });
        }
        actionsDone.synchronized += action.synchronized;
        actionsDone.error += action.error;
      }
    }
    // Log
    if (actionsDone.synchronized || actionsDone.error) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        module: 'Billing', method: 'synchronizeUsers',
        message: `${actionsDone.synchronized} user(s) were successfully synchronized, ${actionsDone.error} got errors`
      });
    } else {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        module: 'Billing', method: 'synchronizeUsers',
        message: `No user needed to be synchronized`
      });
    }
    // Update last synchronization
    const billingSettings = await SettingStorage.getBillingSettings(tenantID);
    billingSettings.stripe.lastSynchronizedOn = new Date();
    await SettingStorage.saveBillingSettings(tenantID, billingSettings);
    // Result
    return actionsDone;
  }

  public async synchronizeUser(user: User, tenantID): Promise<BillingUserSynchronizeAction> {
    // Check
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as BillingUserSynchronizeAction;

    if (user) {
      try {
        const exists = await this.userExists(user);
        let newBillingData: BillingUserData;
        if (!exists) {
          newBillingData = await this.createUser(user);
        } else {
          newBillingData = await this.updateUser(user);
        }
        await UserStorage.saveUserBillingData(tenantID, user.id, newBillingData);
        actionsDone.synchronized++;
        actionsDone.billingData = newBillingData;
      } catch (error) {
        user.billingData.hasSynchroError = true;
        await UserStorage.saveUserBillingData(tenantID, user.id, user.billingData);
        actionsDone.error++;
        Logging.logError({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_BILLING,
          actionOnUser: user,
          module: 'Billing', method: 'synchronizeUser',
          message: `Cannot synchronization user ${user.email} with billing system`,
          detailedMessages: error.message
        });
      }
      return actionsDone;
    }
  }

  public async forceSynchronizeUser(user: User, tenantID): Promise<BillingUserSynchronizeAction> {
    // Check
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as BillingUserSynchronizeAction;
    try {
      // Exists in Billing?
      const billingUser = await this.userExists(user);
      if (billingUser) {
        await this.deleteUser(user);
      }
      // Recreate the Billing user
      delete user.billingData;
      const newBillingData = await this.createUser(user);
      await UserStorage.saveUserBillingData(tenantID, user.id, newBillingData);
      actionsDone.synchronized++;
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        actionOnUser: user,
        module: 'Billing', method: 'forceSynchronizeUser',
        message: `Successfully forced the synchronization of the user '${user.email}'`,
      });
    } catch (error) {
      actionsDone.error++;
      Logging.logError({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        actionOnUser: user,
        module: 'Billing', method: 'forceSynchronizeUser',
        message: `Failed to force the synchronization of the user '${user.email}'`,
        detailedMessages: error.message
      });
    }
    return actionsDone;
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
}
