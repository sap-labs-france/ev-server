import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddSiteIDToChargingStationTask';

export default class AddSiteIDToChargingStationTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    // Get Site Areas
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id, {}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      const result = await global.database.getCollection(tenant.id, 'chargingstations').updateMany(
        {
          siteAreaID: Utils.convertToObjectID(siteArea.id),
        },
        {
          $set: {
            siteID: Utils.convertToObjectID(siteArea.siteID),
          }
        }
      );
      modifiedCount += result.modifiedCount;
    }
    // Delete siteIDs for charging stations without site area
    const result = await global.database.getCollection(tenant.id, 'chargingstations').updateMany(
      {
        siteAreaID: {
          $exists: true,
          $eq: null
        }
      },
      {
        $set: {
          siteID: null,
        }
      }
    );
    modifiedCount += result.modifiedCount;
    // Log in the default tenant
    if (modifiedCount > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${modifiedCount} Charging stations have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.1';
  }

  getName(): string {
    return 'AddSiteIDToChargingStationTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
