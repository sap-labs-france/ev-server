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
    const sitesAdminData: SitesAdminOrOwnerDynamicAuthorizationDataSourceData = {};
    // Get Site IDs from Site Admin flag
    sitesAdminData.siteIDs = await this.getSitesAdminOrOwnerSiteIDs();
    // Set
    this.setData(sitesAdminData);
  }

  // get la liste des sites dont le user connecté est site admin dessus
  private async getSitesAdminOrOwnerSiteIDs(): Promise<string[]> {
    // Get the Site IDs of the Sites for which the user is Site Admin
    const sitesAdmin = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteAdmin: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    const sitesOwner = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteOwner: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );

    const sites = [ ...sitesAdmin.result.map((userSite) => userSite.siteID),
      ...sitesOwner.result.map((userSite) => userSite.siteID) ];
    return sites;
  }
}
