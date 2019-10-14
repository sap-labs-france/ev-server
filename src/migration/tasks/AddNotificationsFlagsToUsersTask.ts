import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';

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
        if (user.role === 'A') {
          user.notifications = {
            sendSessionStarted: true,
            sendOptimalChargeReached: true,
            sendEndOfCharge: true,
            sendEndOfSession: true,
            sendUserAccountStatusChanged: true,
            sendNewRegisteredUser: true,
            sendUnknownUserBadged: true,
            sendChargingStationStatusError: true,
            sendChargingStationRegistered: true,
            sendOcpiPatchStatusError: true,
            sendSmtpAuthError: true
          };
        } else {
          user.notifications = {
            sendSessionStarted: true,
            sendOptimalChargeReached: true,
            sendEndOfCharge: true,
            sendEndOfSession: true,
            sendUserAccountStatusChanged: true,
            sendNewRegisteredUser: false,
            sendUnknownUserBadged: false,
            sendChargingStationStatusError: false,
            sendChargingStationRegistered: false,
            sendOcpiPatchStatusError: false,
            sendSmtpAuthError: false
          };
        }
      } else {
        user.notifications = {
          sendSessionStarted: false,
          sendOptimalChargeReached: false,
          sendEndOfCharge: false,
          sendEndOfSession: false,
          sendUserAccountStatusChanged: false,
          sendNewRegisteredUser: false,
          sendUnknownUserBadged: false,
          sendChargingStationStatusError: false,
          sendChargingStationRegistered: false,
          sendOcpiPatchStatusError: false,
          sendSmtpAuthError: false
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
    return '1.1';
  }

  getName() {
    return 'AddNotificationsFlagsToUsersTask';
  }
}

