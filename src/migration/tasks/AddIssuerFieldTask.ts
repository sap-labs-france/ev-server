import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';

export default class AddIssuerFieldTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    await this.migrateTenant(Constants.DEFAULT_TENANT, Constants.DEFAULT_TENANT, 'users');
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant.id, tenant.name, 'chargingstations');
      await this.migrateTenant(tenant.id, tenant.name, 'companies');
      await this.migrateTenant(tenant.id, tenant.name, 'sites');
      await this.migrateTenant(tenant.id, tenant.name, 'siteareas');
      await this.migrateTenant(tenant.id, tenant.name, 'users');
    }
  }

  async migrateTenant(tenantId: string, tenantName: string, collectionName: string) {
    // Add the status property to the refunded transactions
    const result = await global.database.getCollection<any>(tenantId, collectionName).updateMany(
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
        action: 'AddIssuerField',
        message: `${result.modifiedCount} Object(s) has been updated in the collection '${collectionName}' of Tenant '${tenantName}'`
      });
    }
  }

  getVersion() {
    return '1.2';
  }

  getName() {
    return 'AddIssuerFieldTask';
  }
}
