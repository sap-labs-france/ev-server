import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'MigrateOcpiTransactionsTask';

export default class MigrateOcpiTransactionsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    // Get all transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions').find(
      {
        'ocpiSession': { $exists: true }
      }
    ).toArray();
    for (const transactionMDB of transactionsMDB) {
      // Update
      await global.database.getCollection(tenant.id, 'transactions').findOneAndUpdate(
        { '_id': transactionMDB['_id'] },
        {
          $set: {
            ocpiData: {
              session: transactionMDB.ocpiSession,
              cdr: transactionMDB.ocpiCdr
            }
          },
          $unset: {
            ocpiSession: '',
            ocpiCdr: ''
          }
        },
        { upsert: true, returnOriginal: false }
      );
      modifiedCount++;
    }
    // Log in the default tenant
    if (modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${modifiedCount} Transactions' have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'MigrateOcpiTransactionsTask';
  }
}
