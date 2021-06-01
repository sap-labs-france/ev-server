import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import SiteAdminUsersDynamicAuthorizationDataSource from '../dynamic-data-source/SiteAdminUsersDynamicAuthorizationDataSource';
import Utils from '../../utils/Utils';

export default class SiteAdminUsersDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>): void {
    // Get User IDs
    const siteAdminUsersDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.SITE_ADMIN_USERS) as SiteAdminUsersDynamicAuthorizationDataSource;
    const { userIDs } = siteAdminUsersDataSource.getData();
    // Check
    if (!Utils.isEmptyArray(userIDs)) {
      // Force the filter
      authorizationFilters.filters.userIDs = userIDs;
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'UserID') &&
          !Utils.isNullOrUndefined(extraFilters['UserID'])) {
        const filteredUserIDs: string[] = extraFilters['UserID'].split('|');
        // Override
        authorizationFilters.filters.userIDs = filteredUserIDs.filter(
          (userID) => authorizationFilters.filters.userIDs.includes(userID));
      }
    }
    if (!Utils.isEmptyArray(authorizationFilters.filters.userIDs)) {
      authorizationFilters.authorized = true;
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.TAGS
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.SITE_ADMIN_USERS
    ];
  }
}
