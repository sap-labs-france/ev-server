import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

export default class SiteUsersHashIDsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
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

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'SiteUsersHashIDsTask';
  }
}

