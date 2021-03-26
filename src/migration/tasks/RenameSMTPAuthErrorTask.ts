import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import User from '../../types/User';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'RenameSMTPAuthErrorTask';

export default class RenameSMTPAuthErrorTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let result;
    // Rename the property in the collection
    result = await global.database.getCollection<User>(tenant.id, 'users').updateMany(
      { 'notifications.sendSmtpAuthError': { $exists: true } },
      { $rename: { 'notifications.sendSmtpAuthError': 'notifications.sendSmtpError' } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Users' properties have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
    result = await global.database.getCollection<Notification>(tenant.id, 'notifications').updateMany(
      {
        sourceDescr: {
          $exists: true,
          $eq: 'AuthentificationErrorEmailServer'
        }
      },
      { $set: { sourceDescr: 'EmailServerError' } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Notifications' properties have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.5';
  }

  getName(): string {
    return 'RenameSMTPAuthErrorTask';
  }
}
