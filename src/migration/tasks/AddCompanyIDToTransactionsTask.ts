import Constants from '../../utils/Constants';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddCompanyIDPropertToChargingStationsTask';

export default class AddCompanyIDToTransactionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    // Get all the Sites
    const sites = (await SiteStorage.getSites(tenant, {}, Constants.DB_PARAMS_MAX_LIMIT, ['id', 'companyID'])).result;
    if (!Utils.isEmptyArray(sites)) {
      // Get all the Charging Stations without Company ID
      const chargingStations = await global.database.getCollection<any>(tenant.id, 'chargingstations')
        .find({
          $or: [
            { companyID: { $exists: false } },
            { companyID: null },
            { companyID: '' }
          ]
        })
        .project({ id: 1, siteID: 1 })
        .toArray();
      if (!Utils.isEmptyArray(chargingStations)) {
        for (const chargingStation of chargingStations) {
          // Has a Site
          if (!chargingStation.siteID) {
            continue;
          }
          // Find the Site
          const foundSite = sites.find((site) => chargingStation.siteID?.toString() === site.id);
          if (foundSite?.companyID) {
            await global.database.getCollection<any>(tenant.id, 'chargingstations').updateOne(
              { _id: chargingStation['_id'] },
              {
                $set: { companyID: DatabaseUtils.convertToObjectID(foundSite.companyID) }
              }
            );
            updated++;
          }
        }
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} Transaction(s) have been updated with Company ID in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddCompanyIDToTransactionsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
