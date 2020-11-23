import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddIssuerFieldTask';

export default class AddIssuerFieldTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    await this.migrateTenant(Constants.DEFAULT_TENANT, Constants.DEFAULT_TENANT, 'users');
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant.id, tenant.name, 'chargingstations');
      await this.migrateTenant(tenant.id, tenant.name, 'companies');
      await this.migrateTenant(tenant.id, tenant.name, 'sites');
      await this.migrateTenant(tenant.id, tenant.name, 'siteareas');
      await this.migrateTenant(tenant.id, tenant.name, 'users');
      await this.migrateTenant(tenant.id, tenant.name, 'transactions');
    }
  }

  async migrateTenant(tenantId: string, tenantName: string, collectionName: string): Promise<void> {
    // Add the property to the collection
    const result = await global.database.getCollection<any>(tenantId, collectionName).updateMany(
      {
        'issuer': { $exists: false }
      },
      { $set: { 'issuer': true } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Object(s) has been updated in the collection '${collectionName}' of Tenant '${tenantName}'`
      });
    }
  }

  getVersion(): string {
    return '1.3';
  }

  getName(): string {
    return 'AddIssuerFieldTask';
  }
}
