import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddCompanyIDPropertToChargingStationsTask';

export default class RestoreDataIntegrityInSiteUsersTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
    let deleted = 0;
    // Get all the Site Users
    const siteUsers = await global.database.getCollection<any>(tenant.id, 'siteusers')
      .find({}).project({ _id: 1, siteID: 1, userID: 1 }).toArray();
    if (!Utils.isEmptyArray(siteUsers)) {
      // Get all the Sites
      const sites = (await SiteStorage.getSites(tenant, {}, Constants.DB_PARAMS_MAX_LIMIT, ['id'])).result;
      // Get all the Users
      const users = (await UserStorage.getUsers(tenant, {}, Constants.DB_PARAMS_MAX_LIMIT, ['id'])).result;
      for (const siteUser of siteUsers) {
        let toBeDeleted = true;
        if (siteUser.siteID && siteUser.userID) {
          siteUser.siteID = siteUser.siteID.toString();
          siteUser.userID = siteUser.userID.toString();
          // Find the Site
          const foundSite = sites.find((site) => site.id === siteUser.siteID);
          if (foundSite) {
            // Find the User
            const foudUser = users.find((user) => user.id === siteUser.userID);
            if (foudUser) {
              toBeDeleted = false;
            }
          }
        }
        // Delete
        if (toBeDeleted) {
          await global.database.getCollection<any>(tenant.id, 'siteusers').deleteOne(
            { _id: siteUser._id }
          );
          deleted++;
        }
      }
    }
    // Log in the default tenant
    if (deleted > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${deleted} Site/Users have been deleted in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'RestoreDataIntegrityInSiteUsersTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
