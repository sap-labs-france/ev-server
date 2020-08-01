import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { ConnectorCurrentLimitSource } from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { UpdateWriteOpResult } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'UpdateLimitsInConsumptionsTask';

export default class UpdateLimitsInConsumptionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    let result: UpdateWriteOpResult;
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
      issuer: true, includeDeleted: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const chargingStation of chargingStations.result) {
      for (const connector of chargingStation.connectors) {
        let limitWatts = 0, limitAmps = 0;
        // Amps from chargepoint?
        if (chargingStation.chargePoints) {
          const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
          limitAmps = Utils.getChargingStationAmperage(chargingStation, chargePoint, connector.connectorId);
          limitWatts = Utils.convertAmpToWatt(chargingStation, chargePoint, connector.connectorId, limitAmps);
        // Amps from connector
        } else if (connector.amperage) {
          limitAmps = connector.amperage;
          limitWatts = Utils.convertAmpToWatt(chargingStation, null, connector.connectorId, limitAmps);
        }
        if (limitAmps) {
          // Update
          result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
            {
              chargeBoxID: chargingStation.id,
              connectorId: connector.connectorId,
            },
            {
              $set: {
                limitAmps: limitAmps,
                limitWatts: limitWatts,
                limitSource: ConnectorCurrentLimitSource.CONNECTOR
              }
            }
          );
          updated += result.modifiedCount;
        }
      }
    }
    // Update leftover
    // 22170 -> 22080 W -> 96 A
    result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
      {
        limitWatts: 22170,
      },
      {
        $set: {
          limitAmps: 96,
          limitWatts: 22080,
          limitSource: ConnectorCurrentLimitSource.CONNECTOR
        }
      }
    );
    updated += result.modifiedCount;
    // Update leftover
    // 7390 -> 7360 -> 32 A
    result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
      {
        limitWatts: 7390,
      },
      {
        $set: {
          limitAmps: 32,
          limitWatts: 7360,
          limitSource: ConnectorCurrentLimitSource.CONNECTOR
        }
      }
    );
    updated += result.modifiedCount;
    // Log
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${updated} Charging Stations amperage limit has been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'UpdateLimitsInConsumptionsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
