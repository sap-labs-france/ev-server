import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'MigrateOcpiSettingTask';

export default class MigrateOcpiSettingTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    const setting = await global.database.getCollection<any>(tenant.id, 'settings').findOne(
      { 'identifier': 'ocpi' });
    // Process each setting
    if (setting && setting.content && setting.content.ocpi) {
      if (!setting.content.ocpi.cpo) {
        setting.content.ocpi.cpo = {
          countryCode: setting.content.ocpi.countryCode,
          partyID: setting.content.ocpi.partyID
        };
      }
      if (!setting.content.ocpi.emsp) {
        setting.content.ocpi.emsp = {
          countryCode: setting.content.ocpi.countryCode,
          partyID: setting.content.ocpi.partyID
        };
      }
      delete setting.content.ocpi.countryCode;
      delete setting.content.ocpi.partyID;
      await global.database.getCollection(tenant.id, 'settings').replaceOne(
        { '_id': setting._id },
        setting
      );

      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `OCPI setting has been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'MigrateOcpiSettingTask';
  }
}
