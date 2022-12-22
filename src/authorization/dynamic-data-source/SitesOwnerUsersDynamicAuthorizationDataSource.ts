import { DynamicAuthorizationDataSourceName, SitesOwnerUsersDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import TagStorage from '../../storage/mongodb/TagStorage';
import UserStorage from '../../storage/mongodb/UserStorage';

export default class SitesOwnerUsersDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<SitesOwnerUsersDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.SITES_OWNER_USERS;
  }

  public async loadData(): Promise<void> {
    const sitesOwnerData: SitesOwnerUsersDynamicAuthorizationDataSourceData = {};
    // Get Site and user ID(s)
    const data = await this.getSitesOwnerUserSiteIDs();
    // Set
    sitesOwnerData.siteIDs = data.siteIDs;
    sitesOwnerData.userID = data.userID;
    sitesOwnerData.tagIDs = data.tagIDs;
    this.setData(sitesOwnerData);
  }

  private async getSitesOwnerUserSiteIDs(): Promise<{siteIDs: string[], tagIDs: string[], userID: string}> {
    // Get the Site IDs of the Sites for which the user is Site Owner
    const sites = await UserStorage.getUserSites(this.tenant,
      {
        userIDs: [this.userToken.id],
        siteOwner: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    // Get the tag and user Ids
    const tags = await TagStorage.getTags(this.tenant,
      {
        userIDs: [this.userToken.id]
      },
      Constants.DB_PARAMS_DEFAULT_RECORD,
      ['id']);
    return { siteIDs: sites.result.map((userSite) => userSite.siteID),tagIDs: tags.result.map((tag) => tag.id), userID: this.userToken.id };
  }
}
