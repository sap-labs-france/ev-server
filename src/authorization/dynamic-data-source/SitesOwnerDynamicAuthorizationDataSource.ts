import { DynamicAuthorizationDataSourceName, SitesOwnerDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import UserStorage from '../../storage/mongodb/UserStorage';

export default class SitesOwnerDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<SitesOwnerDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.SITES_OWNER;
  }

  public async loadData(): Promise<void> {
    const sitesOwnerData: SitesOwnerDynamicAuthorizationDataSourceData = {};
    // Get Site IDs from Site Owner flag
    sitesOwnerData.siteIDs = await this.getSitesOwnerSiteIDs();
    // Set
    this.setData(sitesOwnerData);
  }

  private async getSitesOwnerSiteIDs(): Promise<string[]> {
    // Get the Site IDs of the Sites for which the user is Site Owner
    const userSites = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteOwner: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    return userSites.result.map((userSite) => userSite.siteID);
  }
}
