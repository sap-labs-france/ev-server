import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class SiteApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id: string) {
    return super.readById(id, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_SITES));
  }

  public async create(data) {
    const site = await super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_SITES));
    // Check User IDs
    if (data.userIDs) {
      // Assign User IDs to Site
      await super.create({
        siteID: site.data.id,
        userIDs: data.userIDs
      }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_ADD_USERS, { id: site.data.id }));
    }
    return site;
  }

  public async addUsersToSite(siteID: string, userIDs: string[]) {
    return super.update({
      siteID,
      userIDs
    }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_ADD_USERS, { id: siteID }));
  }

  public async addSitesToUser(userID: string, siteIDs: string[]) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER_SITES, { id: userID });
    return super.create({ siteIDs }, url);
  }

  public async unassignSitesToUser(userID: string, siteIDs: string[]) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER_SITES, { id: userID });
    return super.update({ siteIDs }, url);
  }

  public async readUsersForSite(siteID: string) {
    return super.read({
      SiteID: siteID
    }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_USERS, { id: siteID }));
  }

  public async update(data) {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE, { id: data.id }));
  }

  public async delete(id: string) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE, { id }));
  }

  public async assignSiteAdmin(siteID: string, userID: string) {
    return super.update({
      userID: userID,
      siteAdmin: true
    }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_ADMIN, { id: siteID }));
  }

  public async assignSiteOwner(siteID: string, userID: string) {
    return super.update({
      userID: userID,
      siteOwner: true
    }, this.buildRestEndpointUrl(RESTServerRoute.REST_SITE_OWNER, { id: siteID }));
  }

}
