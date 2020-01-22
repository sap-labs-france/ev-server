import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';

export default class AddIssuerFieldTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant, 'chargingstations');
      await this.migrateTenant(tenant, 'companies');
      await this.migrateTenant(tenant, 'sites');
      await this.migrateTenant(tenant, 'siteareas');
    }
  }

  async migrateTenant(tenant: Tenant, collectionName: string) {
    // Add the status property to the refunded transactions
    const result = await global.database.getCollection<any>(tenant.id, collectionName).updateMany(
      {
        'issuer': { $exists: false }
      },
      { $set: { 'issuer': true } },
      { upsert: false }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'AddIssuerFieldTask', method: 'migrateTenant',
        action: 'Migrate',
        message: `${result.modifiedCount} object(s) has been updated in the collection '${collectionName}' of Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddIssuerFieldTask';
  }
}
