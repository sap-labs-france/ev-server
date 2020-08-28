import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'UnmarkTransactionExtraInactivitiesTask';

export default class UnmarkTransactionExtraInactivitiesTask extends MigrationTask {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async migrateTenant(tenant: Tenant) {
    // Get transactions
    const result = await global.database.getCollection<any>(tenant.id, 'transactions').updateMany(
      {
        'stop.extraInactivitySecs': { $gt: 0 }
      },
      {
        $set: { 'stop.extraInactivityComputed': false }
      }
    );
    if (result.modifiedCount > 0) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Transaction(s) have been marked to be recomputed in Tenant '${tenant.name}' ('${tenant.subdomain}')...`,
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'UnmarkTransactionExtraInactivitiesTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
