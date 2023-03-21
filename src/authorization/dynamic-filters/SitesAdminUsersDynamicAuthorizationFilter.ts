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
    const { siteIDs, tagIDs, userID } = sitesAdminUsersDataSource.getData();
    // Flag
    let authFilterUsed = false;
    // Perform site ids check only if organization component is active
    if (Utils.isTenantComponentActive(this.tenant, TenantComponents.ORGANIZATION)) {
      // Init user site IDs
      authorizationFilters.filters.siteAdminIDs = [];
      if (!Utils.isEmptyArray(siteIDs)) {
        authorizationFilters.filters.siteAdminIDs = siteIDs;
        // Check if filter is provided
        if (Utils.objectHasProperty(extraFilters, 'SiteID') && !Utils.isNullOrUndefined(extraFilters['SiteID'])) {
          // Update flag
          authFilterUsed = true;
          const filteredSiteIDs: string[] = extraFilters['SiteID'].split('|');
          // Override
          authorizationFilters.filters.siteAdminIDs = filteredSiteIDs.filter(
            (siteID) => authorizationFilters.filters.siteAdminIDs.includes(siteID));
          // Check auth
          if (!Utils.isEmptyArray(authorizationFilters.filters.siteAdminIDs)) {
            authorizationFilters.authorized = true;
          }
        }
      }
    }
    // Check user filter
    authorizationFilters.filters.ownerID = [];
    if (userID) {
      authorizationFilters.filters.ownerID = [userID];
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'UserID') && !Utils.isNullOrUndefined(extraFilters['UserID'])) {
        // Update flag
        authFilterUsed = true;
        const filteredUserIDs: string[] = extraFilters['UserID'].split('|');
        // Override
        authorizationFilters.filters.ownerID = filteredUserIDs.filter(
          (user) => authorizationFilters.filters.ownerID.includes(user));
        // Check auth
        if (!Utils.isEmptyArray(authorizationFilters.filters.ownerID)) {
          authorizationFilters.authorized = true;
        }
      }
    }
    if (!Utils.isEmptyArray(tagIDs)) {
      // Force the filter
      authorizationFilters.filters.ownUserTags = tagIDs;
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'TagIDs') && !Utils.isNullOrUndefined(extraFilters['TagIDs'])) {
        // Update flag
        authFilterUsed = true;
        const filteredUserTagIDs: string[] = extraFilters['TagIDs'].split('|');
        // Override
        authorizationFilters.filters.ownUserTags = filteredUserTagIDs.filter(
          (tag) => authorizationFilters.filters.ownUserTags.includes(tag));
        // Check auth
        if (!Utils.isEmptyArray(authorizationFilters.filters.ownUserTags)) {
          authorizationFilters.authorized = true;
        }
      }
    }
    // No auth filter, we authorize
    if (!authFilterUsed) {
      authorizationFilters.authorized = true;
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
