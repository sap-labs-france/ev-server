import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { ConnectorCurrentLimitSource } from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddLimitToConsumptionsTask';

export default class AddLimitToConsumptionsTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    let modifiedCount = 0;
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const chargingStation of chargingStations.result) {
      for (const connector of chargingStation.connectors) {
        // Update
        const result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
          {
            chargeBoxID: chargingStation.id,
            connectorId: connector.connectorId,
            limitSource: { $exists: false },
          },
          {
            $set: {
              limitAmps: connector.amperage,
              limitWatts: connector.power,
              limitSource: ConnectorCurrentLimitSource.CONNECTOR
            }
          }
        );
        modifiedCount += result.modifiedCount;
      }
    }
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

  getVersion() {
    return '1.1';
  }

  getName() {
    return 'AddLimitToConsumptions';
  }

  isAsynchronous() {
    return true;
  }
}
