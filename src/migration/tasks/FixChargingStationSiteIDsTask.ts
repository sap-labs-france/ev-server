import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'FixChargingStationSiteIDsTask';

export default class FixChargingStationSiteIDsTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0; let siteArea;
    // Get all the charging stations
    const chargingStations = await global.database.getCollection<any>(tenant.id, 'chargingstations').find({})
      .project({ siteAreaID: 1, _id: 1 })
      .toArray();
    if (!Utils.isEmptyArray(chargingStations)) {
      for (const chargingStation of chargingStations) {
        siteArea = await global.database.getCollection<any>(tenant.id, 'siteareas').findOne({ _id: chargingStation.siteAreaID });
        await global.database.getCollection<any>(tenant.id, 'chargingstations').updateOne(
          { _id: chargingStation._id },
          {
            $set: {
              siteID: siteArea.siteID
            }
          }
        );
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} ChargingStation(s) have been updated with site ID in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'FixChargingStationSiteIDsTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
