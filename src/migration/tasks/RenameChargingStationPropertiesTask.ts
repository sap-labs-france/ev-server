import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'RenameChargingStationPropertiesTask';

export default class RenameChargingStationPropertiesTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Rename the property in the collection
    const result = await global.database.getCollection<ChargingStation>(tenant.id, 'chargingstations').updateMany(
      {},
      { $rename: { 'lastHeartBeat': 'lastSeen' } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Charging Stations' properties have been updated in Tenant '${tenant.name}' ('${tenant.subdomain}')`
      });
    }
  }

  getVersion(): string {
    return '1.1';
  }

  getName(): string {
    return 'RenameChargingStationPropertiesTask';
  }
}
