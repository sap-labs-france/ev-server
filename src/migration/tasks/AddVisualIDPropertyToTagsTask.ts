import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ObjectID } from 'mongodb';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
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
    let tags = await TagStorage.getTags(tenant.id, {}, { limit: Constants.BATCH_PAGE_SIZE, onlyRecordCount: true, skip: 0 });
    const count = tags.count;
    let skip = 0;
    let updated = 0;
    do {
      tags = await TagStorage.getTags(tenant.id, {}, { limit: Constants.BATCH_PAGE_SIZE, skip: skip, sort:{ _id:1 } });
      if (!Utils.isEmptyArray(tags.result)) {
        const visualID = new ObjectID().toHexString();
        for (const tag of tags.result) {
          await global.database.getCollection<any>(tenant.id, 'tags').update(
            { _id: tag.id },
            { $set: { visualID: visualID } });
          updated++;
        }
      }
      skip += Constants.BATCH_PAGE_SIZE;
    } while (skip < count);
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
    return '1.1';
  }

  getName(): string {
    return 'AddVisualIDPropertyToTagsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
