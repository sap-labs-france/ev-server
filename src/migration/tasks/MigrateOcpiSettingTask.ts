import TenantStorage from '../../storage/mongodb/TenantStorage';
import { Action } from '../../types/Authorization';
import global from '../../types/GlobalType';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';

export default class MigrateOcpiSettingTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
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
        action: Action.MIGRATION,
        module: 'MigrateOcpiSettingTask', method: 'migrateTenant',
        message: `OCPI setting has been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'MigrateOcpiSettingTask';
  }
}
