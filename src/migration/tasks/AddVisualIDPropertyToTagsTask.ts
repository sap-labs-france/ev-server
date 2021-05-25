import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddVisualIDPropertyToTagsTask';

export default class AddVisualIDPropertyToTagsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Add the visualID property to tags
    let updated = 0;
    // Get Tags
    const tagsMDB = await global.database.getCollection<any>(tenant.id, 'tags')
      .find({}).toArray();
    if (!Utils.isEmptyArray(tagsMDB)) {
      for (const tagMDB of tagsMDB) {
        await global.database.getCollection<any>(tenant.id, 'tags').findOneAndUpdate(
          { _id: tagMDB._id },
          { $set: { visualID: Cypher.hash(tagMDB._id) } });
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} Tag(s) visualID have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddVisualIDPropertyToTagsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
