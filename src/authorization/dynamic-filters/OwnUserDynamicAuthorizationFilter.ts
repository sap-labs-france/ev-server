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
    const { userID } = ownUserDataSource.getData();
    // Clear
    authorizationFilters.filters.userIDs = [];
    if (userID) {
      // Force the filter
      authorizationFilters.filters.userIDs = [userID];
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'UserID') &&
          !Utils.isNullOrUndefined(extraFilters['UserID'])) {
        const filteredUserIDs: string[] = extraFilters['UserID'].split('|');
        // Override
        authorizationFilters.filters.userIDs = filteredUserIDs.filter(
          (user) => authorizationFilters.filters.userIDs.includes(user));
      }
    }
    if (!Utils.isEmptyArray(authorizationFilters.filters.userIDs)) {
      authorizationFilters.authorized = true;
    }
    // Delete user property in entity in case we are not authorized
    if (!authorizationFilters.authorized && entityData['user']) {
      delete entityData['user'];
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
