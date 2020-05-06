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
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    let modifiedCount = 0;
    // Get Charging Stations
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id, { withChargingStations: true }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      if (siteArea.maximumPower) {
        // Update
        const result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
          {
            siteAreaID: Utils.convertToObjectID(siteArea.id),
            limitSiteAreaSource: { $exists: false },
          },
          {
            $set: {
              limitSiteAreaAmps: Utils.convertWattToAmp(1, siteArea.maximumPower),
              limitSiteAreaWatts: siteArea.maximumPower,
              limitSiteAreaSource: SiteAreaLimitSource.SITE_AREA
            }
          }
        );
        modifiedCount += result.modifiedCount;
      } else {
        let limitSiteAreaWatts = 0;
        for (const chargingStation of siteArea.chargingStations) {
          for (const connector of chargingStation.connectors) {
            limitSiteAreaWatts += connector.power;
          }
        }
        // Update
        const result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
          {
            siteAreaID: Utils.convertToObjectID(siteArea.id),
            limitSiteAreaSource: { $exists: false },
          },
          {
            $set: {
              limitSiteAreaAmps: Utils.convertWattToAmp(1, limitSiteAreaWatts),
              limitSiteAreaWatts: limitSiteAreaWatts,
              limitSiteAreaSource: SiteAreaLimitSource.CHARGING_STATIONS
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
    return '1.0';
  }

  getName() {
    return 'AddSiteAreaLimitToConsumptions';
  }

  isAsynchronous() {
    return true;
  }
}
