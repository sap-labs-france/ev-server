import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import { UpdateResult } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'UpdateEmailsToLowercaseTask';

export default class UpdateEmailsToLowercaseTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
    // Get all the Users
    const updateResult = await global.database.getCollection<any>(tenant.id, 'users').updateMany(
      {},
      [{
        $set: {
          email: { $toLower: '$email' },
        }
      }]
    ) as UpdateResult;
    if (updateResult.modifiedCount > 0) {
    // Log in the default tenant
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updateResult.modifiedCount} User(s) mail have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.1';
  }

  public getName(): string {
    return 'UpdateEmailsToLowercaseTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
