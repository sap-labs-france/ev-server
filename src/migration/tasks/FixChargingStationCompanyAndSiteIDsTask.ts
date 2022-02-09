import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'FixChargingStationCompanyAndSiteIDsTask';

export default class FixChargingStationCompanyAndSiteIDsTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0, siteArea, site;
    // Get all the charging stations
    const chargingStations = await global.database.getCollection<any>(tenant.id, 'chargingstations').find({})
      .project({ siteAreaID: 1, _id: 1 })
      .toArray();
    if (!Utils.isEmptyArray(chargingStations)) {
      for (const chargingStation of chargingStations) {
        if (chargingStation.siteAreaID) {
          siteArea = await global.database.getCollection<any>(tenant.id, 'siteareas').findOne({ _id: chargingStation.siteAreaID });
          if (siteArea) {
            site = await global.database.getCollection<any>(tenant.id, 'sites').findOne({ _id: siteArea.siteID });
            if (site) {
              await global.database.getCollection<any>(tenant.id, 'chargingstations').updateOne(
                { _id: chargingStation._id },
                {
                  $set: {
                    siteID: siteArea.siteID,
                    companyID: site.companyID
                  }
                }
              );
              updated++;
            } else {
              await Logging.logError({
                tenantID: Constants.DEFAULT_TENANT,
                module: MODULE_NAME, method: 'migrateTenant',
                action: ServerAction.MIGRATION,
                message: `Site ID '${siteArea.siteID}' does not exist.`,
              });
            }
          } else {
            await Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
              module: MODULE_NAME, method: 'migrateTenant',
              action: ServerAction.MIGRATION,
              message: `Site Area ID '${chargingStation.siteAreaID}' does not exist.`,
            });
          }
        } else {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME, method: 'migrateTenant',
            action: ServerAction.MIGRATION,
            message: `Charging station ID '${chargingStation._id}' is not assigned to a Site Area.`,
          });
        }
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} ChargingStation(s) have been updated with company ID in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'FixChargingStationCompanyAndSiteIDsTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
