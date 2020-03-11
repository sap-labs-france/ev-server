import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';

export default class AddActivePropertyToTagsTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    // Add the active property to tags
    const result = await global.database.getCollection<any>(tenant.id, 'tags').updateMany(
      {},
      { $set: { 'active': true } },
      { upsert: false }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'AddActivePropertyToTagsTask', method: 'migrateTenant',
        action: 'AddActivePropertyToTags',
        message: `${result.modifiedCount} Tag(s) have been updated in Tenant '${tenant.name}'`
      });
    }
    // Remove deleted property from tags
    await global.database.getCollection<any>(tenant.id, 'tags').updateMany(
      { },
      { $unset: { 'deleted': '' } },
      { upsert: false }
    );
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddActivePropertyToTagsTask';
  }
}
