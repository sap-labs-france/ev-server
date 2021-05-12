import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import AssignedSiteAreasDynamicAuthorizationDataSource from '../dynamic-data-source/AssignedSiteAreasDynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import Utils from '../../utils/Utils';

export default class AssignedSiteAreasDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>): void {
    // Get Site IDs
    const assignedSiteAreasDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.ASSIGNED_SITE_AREAS) as AssignedSiteAreasDynamicAuthorizationDataSource;
    const { siteAreaIDs } = assignedSiteAreasDataSource.getData();
    // Check
    if (!Utils.isEmptyArray(siteAreaIDs)) {
      // Force the filter
      authorizationFilters.filters.siteAreaIDs = siteAreaIDs;
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'SiteAreaID') &&
          !Utils.isNullOrUndefined(extraFilters['SiteAreaID'])) {
        const filteredSiteAreaIDs: string[] = extraFilters['SiteAreaID'].split('|');
        // Override
        authorizationFilters.filters.siteAreaIDs = filteredSiteAreaIDs.filter(
          (siteID) => authorizationFilters.filters.siteAreaIDs.includes(siteID));
      }
    }
    if (!Utils.isEmptyArray(authorizationFilters.filters.siteAreaIDs)) {
      authorizationFilters.authorized = true;
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.SITE_AREAS
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.ASSIGNED_SITE_AREAS
    ];
  }
}
