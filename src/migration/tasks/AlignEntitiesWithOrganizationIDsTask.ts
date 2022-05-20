import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AlignEntitiesWithOrganizationIDsTask';

export default class AlignEntitiesWithOrganizationIDsTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    // Get all the Sites
    const sites = await global.database.getCollection<any>(tenant.id, 'sites').find({ issuer: true })
      .project({ _id: 1, companyID: 1 }).toArray();
    // Get all the Site Areas
    const siteAreas = await global.database.getCollection<any>(tenant.id, 'siteareas').find({ issuer: true })
      .project({ _id: 1, siteID: 1 }).toArray();
    if (!Utils.isEmptyArray(siteAreas)) {
      for (const siteArea of siteAreas) {
        // Ignore
        if (!siteArea.siteID) {
          continue;
        }
        const foundSite = sites.find((site) => site._id.toString() === siteArea.siteID.toString());
        if (foundSite) {
          // Update all
          updated += await SiteAreaStorage.updateEntitiesWithOrganizationIDs(
            tenant, foundSite.companyID.toString(), siteArea.siteID.toString(), siteArea._id.toString());
        } else {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'migrateTenant',
            action: ServerAction.MIGRATION,
            message: `Site ID '${siteArea.siteID.toString()}' does not exist.`,
          });
        }
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} record(s) have been updated with Organization IDs in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.1';
  }

  public getName(): string {
    return 'AlignEntitiesWithOrganizationIDsTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
