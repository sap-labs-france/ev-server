import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';
import Utils from '../../utils/Utils';
import SitesOwnerDynamicAuthorizationDataSource from '../dynamic-data-source/SitesOwnerDynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';

export default class SitesOwnerDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>): void {
    // Get Site IDs
    const sitesOwnerDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.SITES_OWNER) as SitesOwnerDynamicAuthorizationDataSource;
    const { siteIDs } = sitesOwnerDataSource.getData();
    // Clear
    authorizationFilters.filters.siteIDs = [];
    // Check
    if (!Utils.isEmptyArray(siteIDs)) {
      // Force the filter
      authorizationFilters.filters.siteIDs = siteIDs;
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'SiteID') &&
          !Utils.isNullOrUndefined(extraFilters['SiteID'])) {
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

  public getApplicableEntities(): Entity[] {
    return [
      Entity.SITE,
      Entity.USER
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.SITES_OWNER
    ];
  }
}
