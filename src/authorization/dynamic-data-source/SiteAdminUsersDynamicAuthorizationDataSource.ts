import { DynamicAuthorizationDataSourceName, SiteAdminUsersDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import UserStorage from '../../storage/mongodb/UserStorage';

export default class SiteAdminUsersDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<SiteAdminUsersDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.SITE_ADMIN_USERS;
  }

  public async loadData(): Promise<void> {
    const siteAdminUsersData: SiteAdminUsersDynamicAuthorizationDataSourceData = {};
    // Get Site IDs from Site Admin flag
    siteAdminUsersData.userIDs = await this.getSiteAdminUserIDs();
    // Set
    this.setData(siteAdminUsersData);
  }

  private async getSiteAdminUserIDs(): Promise<string[]> {
    // Get the Site IDs where the logged on User is SiteAdmin
    const sites = await UserStorage.getUserSites(this.tenant.id,
      {
        userID: this.userToken.id,
        siteAdmin: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    // Get the User IDs of the Users belonging to Sites where the logged on User is SiteAdmin
    const users = await UserStorage.getUsers(this.tenant.id,
      {
        siteIDs: sites.result.map((userSite) => userSite.siteID)
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']);
    return users.result.map((user) => user.id);
  }
}
