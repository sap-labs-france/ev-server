import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class SiteApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/Site');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
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

  public update(data) {
    return super.update(data, '/client/api/SiteUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/SiteDelete');
  }
}
