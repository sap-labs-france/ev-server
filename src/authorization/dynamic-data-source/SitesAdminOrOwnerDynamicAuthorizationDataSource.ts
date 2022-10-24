import { DynamicAuthorizationDataSourceName, SitesAdminOrOwnerDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import UserStorage from '../../storage/mongodb/UserStorage';

export default class SitesAdminOrOwnerDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<SitesAdminOrOwnerDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.SITES_ADMIN_OR_OWNER;
  }

  public async loadData(): Promise<void> {
    const sitesAdminOrOwnerData: SitesAdminOrOwnerDynamicAuthorizationDataSourceData = {};
    // Get Site IDs from Site AdminOrOwner flag
    sitesAdminOrOwnerData.siteIDs = await this.getSitesAdminOrOwnerSiteIDs();
    // Set
    this.setData(sitesAdminOrOwnerData);
  }

  // Get sites list where user is Admin or Owner
  private async getSitesAdminOrOwnerSiteIDs(): Promise<string[]> {
    // Get the Site IDs of the Sites for which the user is Site Admin
    const sitesAdmin = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteAdmin: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    // Get the Site IDs of the Sites for which the user is Site Owner
    const sitesOwner = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteOwner: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    // Merge two arrays, avoid duplicates and keep only siteIDs
    const sites = [ ...sitesAdmin.result, ...sitesOwner.result ].map((userSite) => userSite.siteID);
    return sites;
  }
}
