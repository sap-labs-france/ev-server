import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tag from '../../types/Tag';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddTagTypeTask';

export default class AddTagTypeTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Add the property to the collection
    const result = await global.database.getCollection<Tag>(tenant.id, 'tags').updateMany(
      {
        'internal': { $exists: false }
      },
      { $set: { 'internal': false, 'deleted': false } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Tag(s) have been updated in Tenant '${tenant.name}'`
      });
    }
    // Remove tagIDs from User
    await global.database.getCollection<any>(tenant.id, 'users').updateMany(
      { },
      { $unset: { 'tagIDs': '', 'mobileLastChanged': '', 'lastLogin': '', 'image': '' } },
      { upsert: false }
    );
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddTagTypeTask';
  }
}
