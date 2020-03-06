import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

export default class AddLimitToConsumptions extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    let modifiedCount = 0;
    // Get all transactions
    const aggregation = [];
    aggregation.push({
      $match: {
        $or: [
          { 'limitWatts': { $exists: false } },
          { 'limitAmps': { $exists: false } }
        ]
      },
    });
    aggregation.push({ $limit: 10000 });
    let consumptionsMDB = [];
    do {
      // Call
      consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
        .aggregate(aggregation).toArray();
      // Set the limit
      for (const consumptionMDB of consumptionsMDB) {
        const chargingStation = await ChargingStationStorage.getChargingStation(tenant.id, consumptionMDB.chargeBoxID);
        if (chargingStation && chargingStation.connectors && chargingStation.connectors[consumptionMDB.connectorId - 1] &&
          chargingStation.connectors[consumptionMDB.connectorId - 1].amperage && chargingStation.connectors[consumptionMDB.connectorId - 1].power) {
          // Add limit
          consumptionMDB.limitAmps = chargingStation.connectors[consumptionMDB.connectorId - 1].amperage;
          consumptionMDB.limitWatts = chargingStation.connectors[consumptionMDB.connectorId - 1].power;
        } else {
          consumptionMDB.limitAmps = 0;
          consumptionMDB.limitWatts = 0;
        }
        // Update
        await global.database.getCollection(tenant.id, 'consumptions').findOneAndUpdate(
          { '_id': consumptionMDB._id },
          { $set: { 'limitAmps': consumptionMDB.limitAmps, 'limitWatts': consumptionMDB.limitWatts } },
          { upsert: true, returnOriginal: false }
        );
        modifiedCount++;
      }
    } while (consumptionsMDB.length !== 0);
    // Log in the default tenant
    if (modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'AddLimitToConsumptions', method: 'migrateTenant',
        action: 'AddLimitToConsumptions',
        message: `${modifiedCount} Consumptions limits have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddLimitToConsumptions';
  }

  isAsynchronous() {
    return true;
  }
}
