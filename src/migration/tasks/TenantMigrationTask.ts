import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../entity/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import User from '../../types/User';
import UserService from '../../server/rest/service/UserService';
import UserStorage from '../../storage/mongodb/UserStorage';

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
    const users = await UserStorage.getUsers(Constants.DEFAULT_TENANT, {}, { limit: Constants.MAX_DB_RECORD_COUNT, skip: 0 });

    if (users.count === 0) {
      // First, create a super admin user
      const password = UserService.generatePassword();
      const user: Partial<User> = {
        name: 'Super',
        firstName: 'Admin',
        password: await UserService.hashPasswordBcrypt(password),
        status: Constants.USER_STATUS_ACTIVE,
        role: Constants.ROLE_SUPER_ADMIN,
        email: 'super.admin@sap.com',
        createdOn: new Date()
      };
      // Save
      await UserStorage.saveUser(Constants.DEFAULT_TENANT, user);

      // Log
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT, module: 'TenantMigrationTask', method: 'createSuperAdmin',
        actionOnUser: user, action: 'Migration', source: 'TenantMigrationTask',
        message: `Super Admin user '${user.email}' created with initial password '${password}'`
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

