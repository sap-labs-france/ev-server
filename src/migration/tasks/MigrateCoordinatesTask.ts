import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';

export default class MigrateCoordinatesTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenantCompanies(tenant);
      await this.migrateTenantSites(tenant);
      await this.migrateTenantSiteAreas(tenant);
      await this.migrateTenantUsers(tenant);
      await this.migrateTenantChargingStations(tenant);
    }
  }

  async migrateTenantCompanies(tenant: Tenant) {
    let updated = 0;
    const companies = await global.database.getCollection<any>(tenant.id, 'companies').aggregate(
      []).toArray();
    // Process each setting
    for (const company of companies) {
      if (company.address && company.address.longitude && company.address.latitude) {
        company.address.coordinates = [
          company.address.longitude,
          company.address.latitude
        ];
        delete company.address.longitude;
        delete company.address.latitude;
        await global.database.getCollection(tenant.id, 'companies').replaceOne(
          { '_id': company._id },
          company
        );
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MigrateCoordinatesTask', method: 'migrateTenant',
        action: 'MigrateCoordinatesTask',
        message: `updated Companies(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  async migrateTenantSites(tenant: Tenant) {
    let updated = 0;
    const sites = await global.database.getCollection<any>(tenant.id, 'sites').aggregate(
      []).toArray();
    // Process each setting
    for (const site of sites) {
      if (site.address && site.address.longitude && site.address.latitude) {
        site.address.coordinates = [
          site.address.longitude,
          site.address.latitude
        ];
        delete site.address.longitude;
        delete site.address.latitude;
        await global.database.getCollection(tenant.id, 'sites').replaceOne(
          { '_id': site._id },
          site
        );
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MigrateCoordinatesTask', method: 'migrateTenant',
        action: 'MigrateCoordinatesTask',
        message: `${updated} Sites(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  async migrateTenantSiteAreas(tenant: Tenant) {
    let updated = 0;
    const siteareas = await global.database.getCollection<any>(tenant.id, 'siteareas').aggregate(
      []).toArray();
    // Process each setting
    for (const sitearea of siteareas) {
      if (sitearea.address && sitearea.address.longitude && sitearea.address.latitude) {
        sitearea.address.coordinates = [
          sitearea.address.longitude,
          sitearea.address.latitude
        ];
        delete sitearea.address.longitude;
        delete sitearea.address.latitude;
        await global.database.getCollection(tenant.id, 'siteareas').replaceOne(
          { '_id': sitearea._id },
          sitearea
        );
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MigrateCoordinatesTask', method: 'migrateTenant',
        action: 'MigrateCoordinatesTask',
        message: `${updated} SiteArea(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  async migrateTenantUsers(tenant: Tenant) {
    let updated = 0;
    const users = await global.database.getCollection<any>(tenant.id, 'users').aggregate(
      []).toArray();
    // Process each setting
    for (const user of users) {
      if (user.address && user.address.longitude && user.address.latitude) {
        user.address.coordinates = [
          user.address.longitude,
          user.address.latitude
        ];
        delete user.address.longitude;
        delete user.address.latitude;
        await global.database.getCollection(tenant.id, 'users').replaceOne(
          { '_id': user._id },
          user
        );
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MigrateCoordinatesTask', method: 'migrateTenant',
        action: 'MigrateCoordinatesTask',
        message: `${updated} User(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  async migrateTenantChargingStations(tenant: Tenant) {
    let updated = 0;
    const chargingstations = await global.database.getCollection<any>(tenant.id, 'chargingstations').aggregate(
      []).toArray();
    // Process each setting
    for (const chargingstation of chargingstations) {
      if (chargingstation.longitude && chargingstation.latitude) {
        chargingstation.coordinates = [
          chargingstation.longitude,
          chargingstation.latitude
        ];
        delete chargingstation.longitude;
        delete chargingstation.latitude;
        await global.database.getCollection(tenant.id, 'chargingstations').replaceOne(
          { '_id': chargingstation._id },
          chargingstation
        );
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MigrateCoordinatesTask', method: 'migrateTenant',
        action: 'MigrateCoordinatesTask',
        message: `${updated} Charging Station(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '0.15';
  }

  getName() {
    return 'MigrateCoordinatesTask';
  }
}
