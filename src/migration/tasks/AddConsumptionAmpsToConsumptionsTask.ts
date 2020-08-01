import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddInstantAmpsToConsumptionsTask';

export default class AddConsumptionAmpsToConsumptionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    const result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
      {
        'consumptionAmps': { $exists: false },
      },
      [
        {
          '$set': {
            'consumptionAmps': { '$divide': ['$consumptionWh', 230] },
          }
        }
      ]
    );
    modifiedCount += result.modifiedCount;
    // Log in the default tenant
    if (modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${modifiedCount} Consumptions have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddConsumptionAmpsToConsumptionsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
