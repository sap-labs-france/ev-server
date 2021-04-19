import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'ChangeAssetIssuerFieldTask';

export default class ChangeAssetIssuerFieldTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant.id, tenant.name);
    }
  }

  async migrateTenant(tenantId: string, tenantName: string): Promise<void> {
    // Set to true for all assets
    const result = await global.database.getCollection<any>(tenantId, 'assets').updateMany(
      {},
      { $set: { 'issuer': true } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Assets of Tenant '${tenantName}' has been updated to issuer true.`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'ChangeAssetIssuerFieldTask';
  }
}
