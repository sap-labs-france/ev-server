import MigrationTask from '../MigrationTask';
import Tenant from '../../entity/Tenant';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';

export default class AddTransactionRefundStatusTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    await global.database.getCollection<any>(tenant.getID(), 'transactions').updateMany(
      { 'refundData': { $exists: true } },
      { $set: { 'refundData.status': Constants.REFUND_TRANSACTION_SUBMITTED } },
      { upsert: false }
    );
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddTransactionRefundStatusTask';
  }
}

