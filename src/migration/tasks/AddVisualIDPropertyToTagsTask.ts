import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ObjectID } from 'mongodb';
import { ServerAction } from '../../types/Server';
import Tag from '../../types/Tag';
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
    let tags: Tag[];
    let updated = 0;
    do {
      // Get the tags
      tags = await global.database.getCollection<any>(tenant.id, 'tags')
        .find({
          $or: [
            { visualID: { $exists: false } },
            { visualID: null },
            { visualID: '' }
          ]
        })
        .limit(Constants.BATCH_PAGE_SIZE)
        .toArray();
      if (!Utils.isEmptyArray(tags)) {
        const visualID = new ObjectID().toHexString();
        for (const tag of tags) {
          await global.database.getCollection<any>(tenant.id, 'tags').updateOne(
            { _id: tag['_id'] },
            { $set: { visualID } }
          );
          updated++;
        }
      }
    } while (tags.length <= Constants.BATCH_PAGE_SIZE); // Avoid infinite loop due to issues in the update process
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
    return '1.4';
  }

  getName(): string {
    return 'AddVisualIDPropertyToTagsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
