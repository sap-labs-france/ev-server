import MigrationTask from '../MigrationTask';
import Tenant from '../../entity/Tenant';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';

export default class AddTransactionRefundStatusTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    // Add the status property to the refunded transactions
    const result = await global.database.getCollection<any>(tenant.getID(), 'transactions').updateMany(
      {
        'refundData': { $exists: true },
        'refundData.status': { $exists: false }
      },
      { $set: { 'refundData.status': Constants.REFUND_STATUS_SUBMITTED } },
      { upsert: false }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'AddTransactionRefundStatusTask', method: 'migrateTenant',
        action: 'MigrateRefundStatus',
        message: `${result.modifiedCount} Refunded Transaction(s) has been updated in Tenant '${tenant.getName()}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddTransactionRefundStatusTask';
  }
}
