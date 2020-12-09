import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'CleanupOrphanBadgeTask';

export default class CleanupOrphanBadgeTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Delete the property from the collection
    const tagCollection = global.database.getCollection<any>(tenant.id, 'tags');
    const tags = await tagCollection.find().toArray();

    let counter = 0;
    for (const tag of tags) {
      const user = await UserStorage.getUserByTagId(tenant.id, tag._id);
      if (!user) {
        await tagCollection.deleteOne({ _id: tag._id });
        counter++;
      }
    }
    // Log in the default tenant
    if (counter > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${counter} Tags(s) have been deleted in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'CleanupOrphanBadgeTask';
  }
}
