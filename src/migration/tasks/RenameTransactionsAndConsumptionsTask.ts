import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';

const MODULE_NAME = 'CleanupAllTransactionsTask';

export default class RenameTransactionsAndConsumptionsTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    // Rename Transaction props
    await this.renameTransactionProperties(tenant);
    // Rename Consumption props
    await this.renameConsumptionProperties(tenant);
  }

  async renameTransactionProperties(tenant: Tenant) {
    // Renamed properties in Transactions
    const result = await global.database.getCollection<any>(tenant.id, 'transactions').updateMany(
      {
        'stop.totalConsumptionWh': { $exists: false },
      },
      {
        $rename: {
          'stop.totalConsumption': 'stop.totalConsumptionWh',
        }
      },
      { upsert: false }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Transactions(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  async renameConsumptionProperties(tenant: Tenant) {
    // Renamed properties in Transactions
    const result = await global.database.getCollection<any>(tenant.id, 'consumptions').updateMany(
      {
        'consumptionWh': { $exists: false },
      },
      {
        $rename: {
          'instantPower': 'instantWatts',
          'consumption': 'consumptionWh',
          'cumulatedConsumption': 'cumulatedConsumptionWh'
        }
      },
      { upsert: false }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Consumption(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.01';
  }

  getName() {
    return 'RenameTransactionsAndConsumptionsTask';
  }

  isAsynchronous() {
    return true;
  }
}
