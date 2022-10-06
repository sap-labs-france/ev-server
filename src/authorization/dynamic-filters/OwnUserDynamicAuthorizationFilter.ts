import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import OwnUserDynamicAuthorizationDataSource from '../dynamic-data-source/OwnUserDynamicAuthorizationDataSource';
import Utils from '../../utils/Utils';

export default class OwnUserDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    // Get User ID
    const ownUserDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.OWN_USER) as OwnUserDynamicAuthorizationDataSource;
    const { userID, tagIDs } = ownUserDataSource.getData();
    // Flag
    let authFilterUsed = false;
    // Clear
    authorizationFilters.filters.userIDs = [];
    authorizationFilters.filters.ownUserTags = [];
    if (userID) {
      // Force the filter
      authorizationFilters.filters.userIDs = [userID];
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'UserID') && !Utils.isNullOrUndefined(extraFilters['UserID'])) {
        // Update flag
        authFilterUsed = true;
        const filteredUserIDs: string[] = extraFilters['UserID'].split('|');
        // Override
        authorizationFilters.filters.userIDs = filteredUserIDs.filter(
          (user) => authorizationFilters.filters.userIDs.includes(user));
        // Check auth
        if (!Utils.isEmptyArray(authorizationFilters.filters.userIDs)) {
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
      Entity.TAG
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.OWN_USER
    ];
  }
}
