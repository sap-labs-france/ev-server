import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'RecomputeAllTransactionsConsumptionsTask';

export default class AddUserInTransactionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let success = 0;
    // Get transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate([
        { $match: { userID: null } }
      ]).toArray();
    if (transactionsMDB.length > 0) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${transactionsMDB.length} Transaction(s) are going to be assigned an user in Tenant '${tenant.name}' ('${tenant.subdomain}')...`,
      });
      for (const transactionMDB of transactionsMDB) {
        // Get the user with tag
        const user = await UserStorage.getUserByTagId(tenant.id, transactionMDB.tagID);
        // Assign and Save the transaction
        if (user && user.name !== 'Unknown') {
          transactionMDB.userID = Utils.convertToObjectID(user.id);
          await global.database.getCollection(tenant.id, 'transactions').updateOne(
            {
              '_id': transactionMDB._id
            },
            {
              $set: {
                'userID': Utils.convertToObjectID(user.id),
              }
            },
            { upsert: false }
          );
          success++;
        }
      }
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${success} Transaction(s) have been assigned an user in Tenant '${tenant.name}' ('${tenant.subdomain}')...`,
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddUserInTransactionsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
