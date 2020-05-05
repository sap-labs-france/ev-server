import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import { UserRole } from '../../types/User';
import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import Utils from '../../utils/Utils';

export default class AddNotificationsFlagsToUsersTask extends MigrationTask {
  async migrate() {
    // Migrate tenants
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
    // Migrate super tenant
    await this.migrateSuperTenant();
  }

  async migrateSuperTenant() {
    // Read all users
    const users: any = await global.database.getCollection(Constants.DEFAULT_TENANT, 'users').aggregate().toArray();
    // Process each user
    for (const user of users) {
      // Exists?
      if (user.notifications && Utils.objectHasProperty(user.notifications, 'sendCarCatalogSynchronizationFailed')) {
        continue;
      }
      // No: Set it
      user.notificationsActive = true;
      user.notifications = {
        sendCarCatalogSynchronizationFailed: true,
      };
      // Update
      await global.database.getCollection(Constants.DEFAULT_TENANT, 'users').findOneAndUpdate(
        { '_id': user._id },
        { $set: user },
        { upsert: true, returnOriginal: false }
      );
    }

  }

  async migrateTenant(tenant) {
    // Read all users
    const users: any = await global.database.getCollection(tenant.id, 'users').aggregate().toArray();
    // Process each user
    for (const user of users) {
      if (user.notificationsActive) {
        if (user.role === UserRole.ADMIN) {
          user.notifications = {
            sendSessionStarted: true,
            sendOptimalChargeReached: true,
            sendEndOfCharge: true,
            sendEndOfSession: true,
            sendUserAccountStatusChanged: true,
            sendSessionNotStarted: true,
            sendUserAccountInactivity: true,
            sendPreparingSessionNotStarted: true,
            sendBillingUserSynchronizationFailed: true,
            sendNewRegisteredUser: true,
            sendUnknownUserBadged: true,
            sendChargingStationStatusError: true,
            sendChargingStationRegistered: true,
            sendOcpiPatchStatusError: true,
            sendSmtpAuthError: true,
            sendOfflineChargingStations: true,
          };
        } else {
          user.notifications = {
            sendSessionStarted: true,
            sendOptimalChargeReached: true,
            sendEndOfCharge: true,
            sendEndOfSession: true,
            sendUserAccountStatusChanged: true,
            sendSessionNotStarted: true,
            sendUserAccountInactivity: true,
            sendPreparingSessionNotStarted: true,
            sendBillingUserSynchronizationFailed: false,
            sendNewRegisteredUser: false,
            sendUnknownUserBadged: false,
            sendChargingStationStatusError: false,
            sendChargingStationRegistered: false,
            sendOcpiPatchStatusError: false,
            sendSmtpAuthError: false,
            sendOfflineChargingStations: false,
          };
        }
      } else {
        user.notifications = {
          sendSessionStarted: false,
          sendOptimalChargeReached: false,
          sendEndOfCharge: false,
          sendEndOfSession: false,
          sendUserAccountStatusChanged: false,
          sendSessionNotStarted: false,
          sendUserAccountInactivity: false,
          sendPreparingSessionNotStarted: false,
          sendBillingUserSynchronizationFailed: false,
          sendNewRegisteredUser: false,
          sendUnknownUserBadged: false,
          sendChargingStationStatusError: false,
          sendChargingStationRegistered: false,
          sendOcpiPatchStatusError: false,
          sendSmtpAuthError: false,
          sendOfflineChargingStations: false,
        };
      }
      // Update
      await global.database.getCollection(tenant.id, 'users').findOneAndUpdate(
        { '_id': user._id },
        { $set: user },
        { upsert: true, returnOriginal: false }
      );
    }
  }

  getVersion() {
    return '1.3';
  }

  getName() {
    return 'AddNotificationsFlagsToUsersTask';
  }
}
