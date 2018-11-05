const MigrationTask = require('../MigrationTask');
const User = require('../../entity/User');
const Tenant = require('../../entity/Tenant');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');

const SLF_TENANT = {
  'name': 'SAP Labs France',
  'email': 'slf@sap.com',
  'subdomain': 'slf'
};

class TenantMigrationTask extends MigrationTask {
  async migrate(){
    await this.createSuperAdmin();
    await this.migrateTenant();
  }

  async createSuperAdmin(){
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
        email: 'superadmin@chargeangels.fr',
        createdOn: new Date().toISOString()
      });

      user = await user.save();
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT, module: 'TenantMigrationTask', method: 'createSuperAdmin',
        actionOnUser: user.getModel(), action: "Migration",
        message: `Super admin user '${user.getID()}' created with initial password '${password}', please update it...`
      });
    }
  }

  async migrateTenant(){
    let tenant = await Tenant.getTenantBySubdomain(SLF_TENANT.subdomain);
    if (!tenant) {
      tenant = new Tenant(SLF_TENANT);
      tenant = await tenant.save();

      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT, module: 'TenantMigrationTask', method: 'migrateTenant', action: "Migration",
        message: `Tenant '${tenant.getID()}' created with subdomain '${tenant.getSubdomain()}'`
      });
    }

    await global.database.migrateTenantDatabase(tenant.getID());

    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT, module: 'TenantMigrationTask', method: 'migrateTenant', action: "Migration",
      message: `Collections migrated to tenant '${tenant.getID()}' with subdomain '${tenant.getSubdomain()}'`
    });

    // Create missing collections if required
    await tenant.createEnvironment();
  }

  getVersion(){
    return "1";
  }

  getName(){
    return "TenantMigrationTask";
  }
}

module.exports = TenantMigrationTask;