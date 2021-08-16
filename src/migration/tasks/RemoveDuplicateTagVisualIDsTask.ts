import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ObjectId } from 'mongodb';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddVisualIDPropertyToTagsTask';

export default class RemoveDuplicateTagVisualIDsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    // Get the dup Tags with same Visual IDs
    const tags = await global.database.getCollection<any>(tenant.id, 'tags')
      .aggregate([
        {
          '$group': {
            '_id': '$visualID',
            'count': { '$sum': 1 }
          }
        },
        {
          '$match': {
            'count': { $gt: 1 }
          }
        }
      ], {
        allowDiskUse: true
      })
      .toArray();
    if (!Utils.isEmptyArray(tags)) {
      // Make the Tag IDs unique
      for (const tag of tags) {
        // Get dup Tags
        const duplicateTags = await TagStorage.getTags(tenant, {
          visualIDs: [tag._id],
        }, Constants.DB_PARAMS_MAX_LIMIT, ['id']);
        // Update the Visual IDs
        for (const duplicateTag of duplicateTags.result) {
          await global.database.getCollection<any>(tenant.id, 'tags').updateOne(
            { _id: duplicateTag.id },
            { $set: { visualID: new ObjectId().toString() } }
          );
          updated++;
        }
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} duplicate Tag(s) Visual IDs have been made unique in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'RemoveDuplicateTagVisualIDsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
