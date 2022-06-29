import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import AssignedOrExternalSitesDynamicAuthorizationDataSource from '../dynamic-data-source/AssignedOrExternalSitesDynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import { TenantComponents } from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class AssignedOrExternalSitesDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    // If organisation is disabled return authorized
    if (!Utils.isTenantComponentActive(this.tenant, TenantComponents.ORGANIZATION)) {
      authorizationFilters.authorized = true;
    } else {
    // Get Site IDs
      const assignedOrExternalSitesDataSource = this.getDataSource(
        DynamicAuthorizationDataSourceName.ASSIGNED_OR_EXTERNAL_SITES) as AssignedOrExternalSitesDynamicAuthorizationDataSource;
      const { siteIDs } = assignedOrExternalSitesDataSource.getData();
      // Clear
      authorizationFilters.filters.siteIDs = [];
      if (!Utils.isEmptyArray(siteIDs)) {
      // Force the filter
        authorizationFilters.filters.siteIDs = siteIDs;
        // Check if filter is provided
        if (Utils.objectHasProperty(extraFilters, 'SiteID') && !Utils.isNullOrUndefined(extraFilters['SiteID'])) {
          const filteredSiteIDs: string[] = extraFilters['SiteID'].split('|');
          // Override
          authorizationFilters.filters.siteIDs = filteredSiteIDs.filter(
            (siteID) => authorizationFilters.filters.siteIDs.includes(siteID));
        }
      }
      if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
        authorizationFilters.authorized = true;
      }
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.SITE, Entity.SITE_AREA, Entity.CHARGING_STATION
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.ASSIGNED_OR_EXTERNAL_SITES
    ];
  }
}
