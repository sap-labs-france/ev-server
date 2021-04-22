import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tag from '../../types/Tag';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SetDefaultTagToUserTask';

export default class SetDefaultTagToUserTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    // Get all the Users
    const users = await UserStorage.getUsers(tenant.id, {
      issuer: true,
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Process them
    if (!Utils.isEmptyArray(users.result)) {
      for (const user of users.result) {
        // Get all the User's Tags
        const tags = await TagStorage.getTags(tenant.id, {
          userIDs: [user.id]
        }, Constants.DB_PARAMS_MAX_LIMIT);
        // Process them
        if (!Utils.isEmptyArray(tags.result)) {
          let numberOfDefaultTag = 0;
          let activeTag: Tag;
          for (const tag of tags.result) {
            // Count default Tag
            if (tag.default) {
              numberOfDefaultTag++;
            }
            // Keep an active tag
            if (tag.active) {
              activeTag = tag;
            }
          }
          // More than one default Tag or no Tag at all
          if (numberOfDefaultTag !== 1) {
            // Clear default User's Tags
            modifiedCount += numberOfDefaultTag;
            await TagStorage.clearDefaultUserTag(tenant.id, user.id);
            if (activeTag) {
              activeTag.default = true;
              await TagStorage.saveTag(tenant.id, activeTag);
            }
          }
        }
      }
    }
    // Log in the default tenant
    if (modifiedCount > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${modifiedCount} Tag(s) have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.1';
  }

  getName(): string {
    return 'SetDefaultTagToUserTask';
  }
}
