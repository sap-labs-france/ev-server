import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import { Role } from '../../types/Authorization';

export default class AddNotificationsFlagsToUsersTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Read all users
    const users: any = await global.database.getCollection(tenant.id, 'users').aggregate().toArray();
    // Process each user
    for (const user of users) {
      if (user.notificationsActive) {
        if (user.role === Role.ADMIN) {
          user.notifications = {
            sendSessionStarted: true,
            sendOptimalChargeReached: true,
            sendEndOfCharge: true,
            sendEndOfSession: true,
            sendUserAccountStatusChanged: true,
            sendUnknownUserBadged: true,
            sendChargingStationStatusError: true,
            sendChargingStationRegistered: true,
            sendOcpiPatchStatusError: true,
            sendSmtpAuthError: true,
            sendSessionNotStarted: true
          };
        } else {
          user.notifications = {
            sendSessionStarted: true,
            sendOptimalChargeReached: true,
            sendEndOfCharge: true,
            sendEndOfSession: true,
            sendUserAccountStatusChanged: true,
            sendUnknownUserBadged: false,
            sendChargingStationStatusError: false,
            sendChargingStationRegistered: false,
            sendOcpiPatchStatusError: false,
            sendSmtpAuthError: false,
            sendSessionNotStarted: true

          };
        }
      } else {
        user.notifications = {
          sendSessionStarted: false,
          sendOptimalChargeReached: false,
          sendEndOfCharge: false,
          sendEndOfSession: false,
          sendUserAccountStatusChanged: false,
          sendUnknownUserBadged: false,
          sendChargingStationStatusError: false,
          sendChargingStationRegistered: false,
          sendOcpiPatchStatusError: false,
          sendSmtpAuthError: false,
          sendSessionNotStarted: false

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
    return '1.2';
  }

  getName() {
    return 'AddNotificationsFlagsToUsersTask';
  }
}

