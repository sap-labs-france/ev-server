import Constants from '../../utils/Constants';
import TSGlobal from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../entity/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import User from '../../entity/User';
declare const global: TSGlobal;

const SLF_TENANT = {
  'name': 'SAP Labs France',
  'email': 'slf@sap.com',
  'subdomain': 'slf'
};
export default class TenantMigrationTask extends MigrationTask {
  async migrate() {
    await this.createSuperAdmin();
    await this.migrateTenant();
  }

  async createSuperAdmin() {
    const users = await User.getUsers(Constants.DEFAULT_TENANT);

    if (users.count === 0) {
      // First, create a super admin user
      const password = User.generatePassword();
      let user = new User(Constants.DEFAULT_TENANT, {
        name: 'Super',
        firstName: 'Admin',
        password: await User.hashPasswordBcrypt(password),
        status: Constants.USER_STATUS_ACTIVE,
        role: Constants.ROLE_SUPER_ADMIN,
        email: 'super.admin@sap.com',
        createdOn: new Date().toISOString()
      });
      // Save
      user = await user.save();
      // Log
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT, module: 'TenantMigrationTask', method: 'createSuperAdmin',
        actionOnUser: user.getModel(), action: 'Migration', source: 'TenantMigrationTask',
        message: `Super Admin user '${user.getEMail()}' created with initial password '${password}'`
      });
    }
  }

  async migrateTenant() {
    let tenant = await Tenant.getTenantBySubdomain(SLF_TENANT.subdomain);
    if (!tenant) {
      tenant = new Tenant(SLF_TENANT);
      tenant = await TenantStorage.saveTenant(tenant.getModel());

      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT, module: 'TenantMigrationTask',
        method: 'migrateTenant', action: 'Migration', source: 'TenantMigrationTask',
        message: `Tenant '${tenant.getID()}' created with subdomain '${tenant.getSubdomain()}'`
      });
    }

    await global.database.migrateTenantDatabase(tenant.getID());

    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT, module: 'TenantMigrationTask',
      method: 'migrateTenant', action: 'Migration', source: 'TenantMigrationTask',
      message: `Collections migrated to tenant '${tenant.getID()}' with subdomain '${tenant.getSubdomain()}'`
    });

    // Create missing collections if required
    await TenantStorage.createTenantDB(tenant.getID());
  }

  getVersion() {
    return '1';
  }

  getName() {
    return 'TenantMigrationTask';
  }
}

