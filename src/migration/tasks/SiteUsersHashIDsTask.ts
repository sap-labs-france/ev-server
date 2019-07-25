import crypto from 'crypto';
import global from '../../types/GlobalType';
import MigrationTask from '../MigrationTask';
import Tenant from '../../entity/Tenant';

export default class SiteUsersHashIDsTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();
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
    const userSitesMDB = await global.database.getCollection<any>(tenant.getID(), 'siteusers')
      .aggregate(aggregation).toArray();
    // Process IDs
    for (const userSiteMDB of userSitesMDB) {
      const idToDelete = userSiteMDB._id;
      // Convert ID
      userSiteMDB._id = crypto.createHash('sha256').update(
        `${userSiteMDB.siteID.toString()}~${userSiteMDB.userID.toString()}`).digest('hex'),
      // Delete
      await global.database.getCollection<any>(
        tenant.getID(), 'siteusers').deleteOne(
        { '_id' : idToDelete }
      );
      // Create
      await global.database.getCollection<any>(
        tenant.getID(), 'siteusers').insertOne(userSiteMDB);
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'SiteUsersHashIDsTask';
  }
}

