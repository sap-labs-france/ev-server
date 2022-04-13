import Constants from '../../utils/Constants';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddVisualIDPropertyToTagsTask';

export default class RemoveDuplicateTagVisualIDsTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
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
      ], DatabaseUtils.buildAggregateOptions())
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
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} duplicate Tag(s) Visual IDs have been made unique in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'RemoveDuplicateTagVisualIDsTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
