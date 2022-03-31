import Constants from '../../utils/Constants';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddCompanyIDPropertToChargingStationsTask';

export default class AddCompanyIDToTransactionsTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
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
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} Transaction(s) have been updated with Company ID in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'AddCompanyIDToTransactionsTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
