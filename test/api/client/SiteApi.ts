import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class SiteApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, '/client/api/Site');
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Sites');
  }

  public async create(data) {
    const site = await super.create(data, '/client/api/SiteCreate');
    // Check User IDs
    if (data.userIDs) {
      // Assign User IDs to Site
      await super.create({
        siteID: site.data.id,
        userIDs: data.userIDs
      }, '/client/api/AddUsersToSite');
    }
    return site;
  }

  public async addUsersToSite(siteId, userIds) {
    return super.create({
      siteID: siteId,
      userIDs: userIds
    }, '/client/api/AddUsersToSite');
  }

  public async update(data) {
    return super.update(data, '/client/api/SiteUpdate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/SiteDelete');
  }
}
