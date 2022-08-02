import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import SitesAdminUsersDynamicAuthorizationDataSource from '../dynamic-data-source/SitesAdminUsersDynamicAuthorizationDataSource';
import { TenantComponents } from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class SitesAdminUsersDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    // Retrieve site ids where user is site admin and logged user id
    const sitesAdminUsersDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.SITES_ADMIN_USERS) as SitesAdminUsersDynamicAuthorizationDataSource;
    const { siteIDs, userID } = sitesAdminUsersDataSource.getData();
    // Perform site ids check only if organization component is active
    if (Utils.isTenantComponentActive(this.tenant, TenantComponents.ORGANIZATION)) {
      // Init user site IDs
      let userSiteIds = [];
      if (!Utils.isEmptyArray(siteIDs)) {
        userSiteIds = siteIDs;
        // Check if filter is provided
        if (Utils.objectHasProperty(extraFilters, 'SiteID') &&
          !Utils.isNullOrUndefined(extraFilters['SiteID'])) {
          const filteredSiteIDs: string[] = extraFilters['SiteID'].split('|');
          // Override
          userSiteIds = filteredSiteIDs.filter(
            (siteID) => userSiteIds.includes(siteID));
        }
      }
      if (!Utils.isEmptyArray(userSiteIds)) {
        authorizationFilters.authorized = true;
      }
    }
    // Check user filter
    if (!authorizationFilters.authorized) {
      let siteAdminUserId = [userID];
      if (userID) {
        // Check if filter is provided
        if (Utils.objectHasProperty(extraFilters, 'UserID') &&
            !Utils.isNullOrUndefined(extraFilters['UserID'])) {
          const filteredUserIDs: string[] = extraFilters['UserID'].split('|');
          // Override
          siteAdminUserId = filteredUserIDs.filter(
            (user) => siteAdminUserId.includes(user));
        }
      }
      if (!Utils.isEmptyArray(siteAdminUserId)) {
        authorizationFilters.authorized = true;
      }
    }
    // Remove sensible data if not authorized and filter is provided
    if (!authorizationFilters.authorized) {
      Utils.removeSensibeDataFromEntity(extraFilters, entityData);
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.CHARGING_STATION,
      Entity.CONNECTOR
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.SITES_ADMIN_USERS
    ];
  }
}
