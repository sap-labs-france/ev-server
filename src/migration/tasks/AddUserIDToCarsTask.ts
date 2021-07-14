import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddCompanyIDPropertToChargingStationsTask';

export default class AddUserIDToCarsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    // Get all the Car Users
    const carUsers = await global.database.getCollection<any>(tenant.id, 'carusers').find({})
      .project({ carID: 1, userID: 1, default: 1 })
      .toArray();
    if (!Utils.isEmptyArray(carUsers)) {
      for (const carUser of carUsers) {
        // Has a User
        if (!carUser.userID) {
          continue;
        }
        await global.database.getCollection<any>(tenant.id, 'cars').updateOne(
          { _id: carUser.carID },
          {
            $set: {
              userID: carUser.userID,
              default: carUser.default,
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
        message: `${updated} Car(s) have been updated with User ID in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddUserIDToCarsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
