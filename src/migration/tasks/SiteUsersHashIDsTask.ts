import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import global from '../../types/GlobalType';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';

export default class SiteUsersHashIDsTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        '_id': {
          $type: 'objectId'
        }
      }
    });
    // Exec
    const userSitesMDB = await global.database.getCollection<any>(tenant.id, 'siteusers')
      .aggregate(aggregation).toArray();
    // Process IDs
    for (const userSiteMDB of userSitesMDB) {
      const idToDelete = userSiteMDB._id;
      // Convert ID
      userSiteMDB._id = Cypher.hash(`${userSiteMDB.siteID.toString()}~${userSiteMDB.userID.toString()}`);
      // Delete
      await global.database.getCollection<any>(
        tenant.id, 'siteusers').deleteOne(
        { '_id' : idToDelete }
      );
      // Create
      await global.database.getCollection<any>(
        tenant.id, 'siteusers').insertOne(userSiteMDB);
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'SiteUsersHashIDsTask';
  }
}

