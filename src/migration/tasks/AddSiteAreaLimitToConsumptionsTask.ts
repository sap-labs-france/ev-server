import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import { SiteAreaLimitSource } from '../../types/ChargingStation';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddSiteAreaLimitToConsumptionsTask';

export default class AddSiteAreaLimitToConsumptionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    // Get Charging Stations
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id, { withChargingStations: true }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      let limitSiteAreaWatts = 0;
      let limitChargingStationsWatts = 0;
      if (siteArea.maximumPower) {
        limitSiteAreaWatts = siteArea.maximumPower;
      }
      // Compute charging station power
      for (const chargingStation of siteArea.chargingStations) {
        const limitAmps = Utils.getChargingStationAmperage(chargingStation);
        limitChargingStationsWatts += Utils.convertAmpToWatt(chargingStation, null, 0, limitAmps);
      }
      // Update Consumption
      limitSiteAreaWatts = limitSiteAreaWatts ? limitSiteAreaWatts : limitChargingStationsWatts;
      const result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
        {
          siteAreaID: Utils.convertToObjectID(siteArea.id),
        },
        {
          $set: {
            limitSiteAreaAmps: limitSiteAreaWatts / 230,
            limitSiteAreaWatts: limitSiteAreaWatts,
            limitSiteAreaSource: SiteAreaLimitSource.CHARGING_STATIONS
          }
        }
      );
      modifiedCount += result.modifiedCount;
      // Update Site Area
      await global.database.getCollection(tenant.id, 'siteareas').updateOne(
        {
          '_id': Utils.convertToObjectID(siteArea.id)
        },
        {
          $set: {
            'voltage': 230,
            'numberOfPhases': 3,
            'maximumPower': limitSiteAreaWatts,
          }
        },
        { upsert: false }
      );
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

  getVersion(): string {
    return '1.3';
  }

  getName(): string {
    return 'AddSiteAreaLimitToConsumptions';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
