import { BillingDataStart, BillingDataStop, BillingDataUpdate, BillingPartialUser, BillingTax, BillingUserData, BillingUserSynchronizeAction } from '../../types/Billing';
import User, { Status } from '../../types/User';
import { Action } from '../../types/Authorization';
import { BillingSetting } from '../../types/Setting';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Transaction from '../../types/Transaction';
import UserStorage from '../../storage/mongodb/UserStorage';

export default abstract class Billing<T extends BillingSetting> {

  // Protected because only used in subclasses at the moment
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
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as BillingUserSynchronizeAction;
    // Get recently updated customers from Billing application
    let userIDsChangedInBilling = await this.getUpdatedUserIDsInBilling();
    // Sync e-Mobility New Users with no billing data + e-Mobility Users that have been updated after last sync
    const usersNotSynchronized = await UserStorage.getUsers(tenantID,
      { 'statuses': [Status.ACTIVE], 'notSynchronizedBillingData': true },
      { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
    if (usersNotSynchronized.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        module: 'Billing',
        method: 'synchronizeUsers',
        message: `${usersNotSynchronized.count} new user(s) are going to be synchronized in the Billing system`
      });
      for (const user of usersNotSynchronized.result) {
        const action = await this.synchronizeUser(user, tenantID);
        const billingUser = await this.getUserByEmail(user.email);
        // Delete duplicate customers
        if (userIDsChangedInBilling && userIDsChangedInBilling.length > 0) {
          userIDsChangedInBilling = userIDsChangedInBilling.filter((id) => id !== billingUser.billingData.customerID);
        }
        actionsDone.synchronized += action.synchronized;
        actionsDone.error += action.error;
      }
    }
    // Synchronize e-Mobility User's Billing data
    if (userIDsChangedInBilling && userIDsChangedInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        module: 'Billing',
        method: 'synchronizeUsers',
        message: `${userIDsChangedInBilling.length} e-Mobility user(s) are going to be synchronized in the Billing system`
      });
      for (const userIDChangedInBilling of userIDsChangedInBilling) {
        // Get Billing User
        const billingUser = await this.getUser(userIDChangedInBilling);
        // Get e-Mobility User
        const user = await UserStorage.getUserByBillingID(tenantID, userIDChangedInBilling);

        if (billingUser) {
          if (user) {
            const action = await this.synchronizeUser(user, tenantID);
            actionsDone.synchronized += action.synchronized;
            actionsDone.error += action.error;
          } else {
            actionsDone.error++;
            // Log
            Logging.logError({
              tenantID: tenantID,
              source: Constants.CENTRAL_SERVER,
              action: Action.SYNCHRONIZE_BILLING,
              module: 'Billing',
              method: 'synchronizeUsers',
              message: `Billing user with ID '${userIDChangedInBilling}' and email '${billingUser.email}' does not exist in e-Mobility`
            });
          }
        } else if (user) {
          // Only triggers an error if e-Mobility user is not deleted
          actionsDone.error++;
          Logging.logError({
            tenantID: tenantID,
            source: Constants.CENTRAL_SERVER,
            action: Action.SYNCHRONIZE_BILLING,
            module: 'Billing',
            method: 'synchronizeUsers',
            message: `Billing user with ID '${userIDChangedInBilling}' does not exist`
          });
        }
      }
    }
    if (actionsDone.synchronized > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Action.SYNCHRONIZE_BILLING,
        module: 'Billing',
        method: 'synchronizeUsers',
        message: `${actionsDone.synchronized} user(s) have been synchronized successfully`
      });

      // Update last synchronization
      const billingSettings = await SettingStorage.getBillingSettings(tenantID);
      // Save last synchronization
      billingSettings.stripe.lastSynchronizedOn = new Date();
      // Save
      await SettingStorage.saveBillingSettings(tenantID, billingSettings);
    }
    return actionsDone;
  }

  /**
   * Synchronize a single user in the Billing system
   * @param user user to synchronize
   * @param tenantID ID of the tenant
   */
  public async synchronizeUser(user: User, tenantID): Promise<BillingUserSynchronizeAction> {
    // Check
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as BillingUserSynchronizeAction;

    if (user) {
      try {
        const billingUser = await this.userExists(user);
        let newBillingData: BillingUserData;
        if (!billingUser) {
          newBillingData = await this.createUser(user);
        } else {
          newBillingData = await this.updateUser(user);
        }
        await UserStorage.saveUserBillingData(tenantID, user.id, newBillingData);
        actionsDone.synchronized++;
      } catch (error) {
        actionsDone.error++;
        Logging.logError({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_BILLING,
          module: 'Billing',
          method: 'synchronizeUser',
          message: `Cannot force synchronization of user ${user.email}`,
          detailedMessages: error.message
        });
      }
      return actionsDone;
    }
  }

  /**
   * Force synchronization for a single user in the Billing system
   * It will override user's billing data
   * @param user user to synchronize
   * @param tenantID ID of the tenant
   */
  public async forceUserSynchronization(user: User, tenantID): Promise<BillingUserSynchronizeAction> {
    // Check
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as BillingUserSynchronizeAction;

    if (user) {
      try {
        const billingUser = await this.userExists(user);
        if (billingUser) {
          await this.deleteUser(user);
        }
        delete user.billingData;
        const newBillingData = await this.createUser(user);
        await UserStorage.saveUserBillingData(tenantID, user.id, newBillingData);
        actionsDone.synchronized++;
      } catch (error) {
        actionsDone.error++;
        Logging.logError({
          tenantID: tenantID,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_BILLING,
          module: 'Billing',
          method: 'forceUserSynchronization',
          message: `Cannot force synchronization of user ${user.email}`,
          detailedMessages: error.message
        });
      }
      return actionsDone;
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
}
