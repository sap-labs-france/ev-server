import { DynamicAuthorizationDataSourceName, SitesAdminUsersDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import UserStorage from '../../storage/mongodb/UserStorage';

export default class SitesAdminUsersDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<SitesAdminUsersDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.SITES_ADMIN_USERS;
  }

  public async loadData(): Promise<void> {
    const sitesAdminData: SitesAdminUsersDynamicAuthorizationDataSourceData = {};
    // Get Site and user ID(s)
    const data = await this.getSitesAdminUserSiteIDs();
    // Set
    sitesAdminData.siteIDs = data.siteIDs;
    sitesAdminData.userID = data.userID;
    this.setData(sitesAdminData);
  }

  private async getSitesAdminUserSiteIDs(): Promise<{siteIDs: string[], userID: string}> {
    // Get the Site IDs of the Sites for which the user is Site Admin
    const sites = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteAdmin: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    return { siteIDs: sites.result.map((userSite) => userSite.siteID), userID: this.userToken.id };
  }
}
