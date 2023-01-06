import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import SitesOwnerUsersDynamicAuthorizationDataSource from '../dynamic-data-source/SitesOwnerUsersDynamicAuthorizationDataSource';
import { TenantComponents } from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class SitesOwnerUsersDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    // Retrieve site ids where user is site owner and logged user id
    const sitesOwnerUsersDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.SITES_OWNER_USERS) as SitesOwnerUsersDynamicAuthorizationDataSource;
    const { siteIDs, tagIDs, userID } = sitesOwnerUsersDataSource.getData();
    // Flag
    let authFilterUsed = false;
    // Perform site ids check only if organization component is active
    if (Utils.isTenantComponentActive(this.tenant, TenantComponents.ORGANIZATION)) {
      // Init user site IDs
      authorizationFilters.filters.siteOwnerIDs = [];
      if (!Utils.isEmptyArray(siteIDs)) {
        authorizationFilters.filters.siteOwnerIDs = siteIDs;
        // Check if filter is provided
        if (Utils.objectHasProperty(extraFilters, 'SiteID') && !Utils.isNullOrUndefined(extraFilters['SiteID'])) {
          // Update flag
          authFilterUsed = true;
          const filteredSiteIDs: string[] = extraFilters['SiteID'].split('|');
          // Override
          authorizationFilters.filters.siteOwnerIDs = filteredSiteIDs.filter(
            (siteID) => authorizationFilters.filters.siteOwnerIDs.includes(siteID));
          // Check auth
          if (!Utils.isEmptyArray(authorizationFilters.filters.siteOwnerIDs)) {
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
      Entity.TRANSACTION,
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.SITES_OWNER_USERS
    ];
  }
}
