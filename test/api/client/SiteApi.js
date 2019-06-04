const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');

class SiteApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/Site', id);
  }

  readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/Sites', params, paging, ordering);
  }

  async create(data) {
    const site = await super.create('/client/api/SiteCreate', data);
    // Check User IDs
    if (data.userIDs) {
      // Assign User IDs to Site
      await super.create('/client/api/AddUsersToSite', {
        siteID: site.data.id,
        userIDs: data.userIDs
      });
    }
    return site;
  }

  update(data) {
    return super.update('/client/api/SiteUpdate', data);
  }

  delete(id) {
    return super.delete('/client/api/SiteDelete', id);
  }
}

module.exports = SiteApi;