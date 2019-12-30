import BackendError from '../../exception/BackendError';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import { BillingDataStart, BillingDataStop, BillingDataUpdate, BillingPartialUser, BillingUserData, BillingUserSynchronizeAction } from '../../types/Billing';
import { BillingSetting } from '../../types/Setting';
import Transaction from '../../types/Transaction';
import User from '../../types/User';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import BillingFactory from './BillingFactory';

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
    // Get Billing implementation from factory
    const billingImpl = await BillingFactory.getBillingImpl(tenantID);
    if (!billingImpl) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Billing settings are not configured',
        module: 'BillingService',
        method: 'handleSynchronizeUsers',
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
      });
    }
    // Check
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as BillingUserSynchronizeAction;
    // Get recently updated customers from Billing application
    let userIDsChangedInBilling = await billingImpl.getUpdatedUserIDsInBilling();
    // Sync e-Mobility New Users with no billing data + e-Mobility Users that have been updated after last sync
    const usersNotSynchronized = await UserStorage.getUsers(tenantID,
      { 'statuses': [Constants.USER_STATUS_ACTIVE], 'notSynchronizedBillingData': true },
      { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID': 1 } });
    if (usersNotSynchronized.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${usersNotSynchronized.count} users are going to be synchronized in the Billing system`
      });
      for (const user of usersNotSynchronized.result) {
        try {
          // Synchronize
          let newBillingUserData;
          if (user.billingData) {
            // Update
            newBillingUserData = await billingImpl.updateUser(user);
          } else {
            // Create
            newBillingUserData = await billingImpl.createUser(user);
          }
          // Save Billing data
          await UserStorage.saveUserBillingData(tenantID, user.id, newBillingUserData);
          actionsDone.synchronized++;
          // Log
          Logging.logInfo({
            tenantID: tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: Constants.ACTION_SYNCHRONIZE_BILLING,
            module: 'BillingService', method: 'handleSynchronizeUsers',
            message: 'User have been synchronized successfully'
          });
          // Delete duplicate customers
          if (userIDsChangedInBilling && userIDsChangedInBilling.length > 0) {
            userIDsChangedInBilling = userIDsChangedInBilling.filter((id) => id !== newBillingUserData.customerID);
          }
        } catch (error) {
          actionsDone.error++;
          // Log
          Logging.logError({
            tenantID: tenantID,
            user: user,
            source: Constants.CENTRAL_SERVER,
            action: Constants.ACTION_SYNCHRONIZE_BILLING,
            module: 'BillingService', method: 'handleSynchronizeUsers',
            message: `Synchronization error: ${error.message}`,
            detailedMessages: error
          });
        }
      }
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${usersNotSynchronized.count} users have been synchronized successfully in the Billing system`
      });
    }
    // Synchronize e-Mobility User's Billing data
    if (userIDsChangedInBilling && userIDsChangedInBilling.length > 0) {
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${userIDsChangedInBilling.length} e-Mobility users are going to be synchronized with Billing users`
      });
      for (const userIDChangedInBilling of userIDsChangedInBilling) {
        // Get Billing User
        const billingUser = await billingImpl.getUser(userIDChangedInBilling);
        if (billingUser) {
          // Get e-Mobility User
          const user = await UserStorage.getUserByEmail(tenantID, billingUser.email);
          if (user) {
            // Update & Save
            user.billingData.customerID = billingUser.billingData.customerID;
            user.billingData.lastChangedOn = new Date();
            await UserStorage.saveUser(tenantID, user, false);
            actionsDone.synchronized++;
            // Log
            Logging.logInfo({
              tenantID: tenantID,
              user: user,
              source: Constants.CENTRAL_SERVER,
              action: Constants.ACTION_SYNCHRONIZE_BILLING,
              module: 'BillingService', method: 'handleSynchronizeUsers',
              message: 'User have been synchronized successfully'
            });
          } else {
            actionsDone.error++;
            // Log
            Logging.logError({
              tenantID: tenantID,
              source: Constants.CENTRAL_SERVER,
              action: Constants.ACTION_SYNCHRONIZE_BILLING,
              module: 'BillingService', method: 'handleSynchronizeUsers',
              message: `Billing user with ID '${userIDChangedInBilling}' and email '${billingUser.email}' does not exist in e-Mobility`
            });
          }
        } else {
          actionsDone.error++;
          // Log
          Logging.logError({
            tenantID: tenantID,
            source: Constants.CENTRAL_SERVER,
            action: Constants.ACTION_SYNCHRONIZE_BILLING,
            module: 'BillingService', method: 'handleSynchronizeUsers',
            message: `Billing user with ID '${userIDChangedInBilling}' does not exist`
          });
        }
      }
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'BillingService', method: 'handleSynchronizeUsers',
        message: `${userIDsChangedInBilling.length} e-Mobility users have been synchronized successfully`
      });
    }
    // Update last synchronization
    const billingSettings = await SettingStorage.getBillingSettings(tenantID);
    // Save last synchronization
    billingSettings.stripe.lastSynchronizedOn = new Date();
    // Save
    await SettingStorage.saveBillingSettings(tenantID, billingSettings);

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
}
