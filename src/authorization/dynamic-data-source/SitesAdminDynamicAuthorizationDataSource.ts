import { DynamicAuthorizationDataSourceName, SitesAdminDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import UserStorage from '../../storage/mongodb/UserStorage';

export default class SitesAdminDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<SitesAdminDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.SITES_ADMIN;
  }

  public async loadData(): Promise<void> {
    const sitesAdminData: SitesAdminDynamicAuthorizationDataSourceData = {};
    // Get Site IDs from Site Admin flag
    sitesAdminData.siteIDs = await this.getSitesAdminSiteIDs();
    // Set
    this.setData(sitesAdminData);
  }

  private async getSitesAdminSiteIDs(): Promise<string[]> {
    // Get the Site IDs of the Sites for which the user is Site Admin
    const userSites = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteAdmin: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    return userSites.result.map((userSite) => userSite.siteID);
  }
}
