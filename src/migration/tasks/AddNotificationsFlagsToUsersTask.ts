import User, { UserRole } from '../../types/User';

import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserNotifications from '../../types/UserNotifications';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

export default class AddNotificationsFlagsToUsersTask extends MigrationTask {
  async migrate(): Promise<void> {
    // Migrate tenants
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
    // Migrate super tenant
    await this.migrateSuperTenant();
  }

  async migrateSuperTenant(): Promise<void> {
    // Read all users
    const users: User[] = await global.database.getCollection<User>(Constants.DEFAULT_TENANT, 'users').aggregate().toArray();
    // Process each user
    for (const user of users) {
      // Exists?
      if (user.notifications && Utils.objectHasProperty(user.notifications, 'sendCarCatalogSynchronizationFailed')) {
        continue;
      }
      // No: Set it
      user.notificationsActive = true;
      user.notifications = {
        sendCarCatalogSynchronizationFailed: user.notifications.sendCarCatalogSynchronizationFailed ? user.notifications.sendCarCatalogSynchronizationFailed : false,
      } as UserNotifications;
      // Update
      await global.database.getCollection(Constants.DEFAULT_TENANT, 'users').findOneAndUpdate(
        { '_id': user['_id'] },
        { $set: user },
        { upsert: true, returnOriginal: false }
      );
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Read all users
    const users: User[] = await global.database.getCollection<User>(tenant.id, 'users').aggregate().toArray();
    // Process each user
    for (const user of users) {
      // Keep current setting
      user.notifications = {
        sendSessionStarted: user.notifications?.sendSessionStarted ? user.notifications.sendSessionStarted : false,
        sendOptimalChargeReached: user.notifications?.sendOptimalChargeReached ? user.notifications.sendOptimalChargeReached : false,
        sendEndOfCharge: user.notifications?.sendEndOfCharge ? user.notifications.sendEndOfCharge : false,
        sendEndOfSession: user.notifications?.sendEndOfSession ? user.notifications.sendEndOfSession : false,
        sendUserAccountStatusChanged: user.notifications?.sendUserAccountStatusChanged ? user.notifications.sendUserAccountStatusChanged : false,
        sendSessionNotStarted: user.notifications?.sendSessionNotStarted ? user.notifications.sendSessionNotStarted : false,
        sendUserAccountInactivity: user.notifications?.sendUserAccountInactivity ? user.notifications.sendUserAccountInactivity : false,
        sendPreparingSessionNotStarted: user.notifications?.sendPreparingSessionNotStarted ? user.notifications.sendPreparingSessionNotStarted : false,
        sendNewRegisteredUser: user.notifications?.sendNewRegisteredUser ? user.notifications.sendNewRegisteredUser : false,
        sendUnknownUserBadged: user.notifications?.sendUnknownUserBadged ? user.notifications.sendUnknownUserBadged : false,
        sendChargingStationStatusError: user.notifications?.sendChargingStationStatusError ? user.notifications.sendChargingStationStatusError : false,
        sendChargingStationRegistered: user.notifications?.sendChargingStationRegistered ? user.notifications.sendChargingStationRegistered : false,
        sendOcpiPatchStatusError: user.notifications?.sendOcpiPatchStatusError ? user.notifications.sendOcpiPatchStatusError : false,
        sendSmtpAuthError: user.notifications?.sendSmtpAuthError ? user.notifications.sendSmtpAuthError : false,
        sendOfflineChargingStations: user.notifications?.sendOfflineChargingStations ? user.notifications.sendOfflineChargingStations : false,
        sendBillingSynchronizationFailed: user.notifications?.sendBillingSynchronizationFailed ? user.notifications.sendBillingSynchronizationFailed : false,
        sendCarCatalogSynchronizationFailed: user.notifications?.sendCarCatalogSynchronizationFailed ? user.notifications.sendCarCatalogSynchronizationFailed : false,
        sendComputeAndApplyChargingProfilesFailed: user.notifications?.sendComputeAndApplyChargingProfilesFailed ?
          user.notifications.sendComputeAndApplyChargingProfilesFailed : false,
        sendEndUserErrorNotification: user.notifications?.sendEndUserErrorNotification ? user.notifications.sendEndUserErrorNotification : false,
        sendBillingNewInvoice: user.notifications?.sendBillingNewInvoice ? user.notifications.sendBillingNewInvoice : false,
      };
      // Add new prop
      if (user.role === UserRole.ADMIN) {
        user.notifications.sendEndUserErrorNotification = true;
      }
      // Update
      await global.database.getCollection(tenant.id, 'users').findOneAndUpdate(
        { '_id': user['_id'] },
        { $set: user },
        { upsert: true, returnOriginal: false }
      );
    }
  }

  getVersion(): string {
    return '1.5';
  }

  getName(): string {
    return 'AddNotificationsFlagsToUsersTask';
  }
}
