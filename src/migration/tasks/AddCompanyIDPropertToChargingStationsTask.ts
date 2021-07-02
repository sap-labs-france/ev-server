import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddCompanyIDPropertToChargingStationsTask';

export default class AddCompanyIDPropertToChargingStationsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    let site: Site;
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
    }, Constants.DB_PARAMS_MAX_LIMIT, ['id', 'siteID']);
    if (chargingStations.count > 0) {
      for (const chargingStation of chargingStations.result) {
        site = await SiteStorage.getSite(tenant, chargingStation.siteID, {}, ['companyID']);
        if (site && site.companyID) {
          await global.database.getCollection<any>(tenant.id, 'chargingstations').updateOne(
            { _id: chargingStation.id },
            {
              $set: { companyID: DatabaseUtils.convertToObjectID(site.companyID) }
            }
          );
          updated++;
        }
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} Charging station(s) company have been added in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddCompanyIDPropertToChargingStationsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
