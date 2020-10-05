import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'CleanupAllTransactionsTask';

export default class RenameTransactionsAndConsumptionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Consumptions
    await this.renameConsumptionProperties(tenant);
    await this.deleteConsumptionProperties(tenant);
  }

  getVersion(): string {
    return '1.1';
  }

  getName(): string {
    return 'RenameTransactionsAndConsumptionsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }

  private async deleteConsumptionProperties(tenant: Tenant): Promise<void> {
    const result = await global.database.getCollection<any>(tenant.id, 'consumptions').updateMany(
      { },
      {
        $unset: {
          'amperage': '',
        }
      }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'deleteConsumptionProperties',
        message: `${result.modifiedCount} Consumption(s) unused properties have been removed in Tenant '${tenant.name}' ('${tenant.subdomain}')`
      });
    }
  }

  private async renameConsumptionProperties(tenant: Tenant): Promise<void> {
    // Renamed properties in Transactions
    const result = await global.database.getCollection<any>(tenant.id, 'consumptions').updateMany(
      {
        'instantVolts': { $exists: false },
      },
      {
        $rename: {
          'voltage': 'instantVolts',
          'voltageL1': 'instantVoltsL1',
          'voltageL2': 'instantVoltsL2',
          'voltageL3': 'instantVoltsL3',
          'voltageDC': 'instantVoltsDC',
          'amperageL1': 'instantAmpsL1',
          'amperageL2': 'instantAmpsL2',
          'amperageL3': 'instantAmpsL3',
          'amperageDC': 'instantAmpsDC',
        }
      }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'renameConsumptionProperties',
        message: `${result.modifiedCount} Consumption(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }
}
