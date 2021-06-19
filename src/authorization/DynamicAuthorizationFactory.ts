import { DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName, DynamicAuthorizationFilterName } from '../types/Authorization';

import AssignedSitesCompaniesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesCompaniesDynamicAuthorizationDataSource';
import AssignedSitesCompaniesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesCompaniesDynamicAuthorizationFilter';
import AssignedSitesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesDynamicAuthorizationDataSource';
import AssignedSitesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesDynamicAuthorizationFilter';
import DynamicAuthorizationDataSource from './DynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from './DynamicAuthorizationFilter';
import OwnUserDynamicAuthorizationDataSource from './dynamic-data-source/OwnUserDynamicAuthorizationDataSource';
import OwnUserDynamicAuthorizationFilter from './dynamic-filters/OwnUserDynamicAuthorizationFilter';
import SitesAdminDynamicAuthorizationDataSource from './dynamic-data-source/SitesAdminDynamicAuthorizationDataSource';
import SitesAdminDynamicAuthorizationFilter from './dynamic-filters/SitesAdminDynamicAuthorizationFilter';
import SitesOwnerDynamicAuthorizationDataSource from './dynamic-data-source/SitesOwnerDynamicAuthorizationDataSource';
import SitesOwnerDynamicAuthorizationFilter from './dynamic-filters/SitesOwnerDynamicAuthorizationFilter';
import Tenant from '../types/Tenant';
import UserToken from '../types/UserToken';

export default class DynamicAuthorizationFactory {
  public static async getDynamicFilter(tenant: Tenant, userToken: UserToken,
      filter: DynamicAuthorizationFilterName,
      existingDataSources?: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>>):
      Promise<DynamicAuthorizationFilter> {
    // Check invertion of filter
    let negateFilter = false;
    if (filter?.startsWith('-')) {
      negateFilter = true;
      filter = filter.substring(1) as DynamicAuthorizationFilterName;
    }
    // Return the implementation
    let dynamicFilter: DynamicAuthorizationFilter;
    switch (filter) {
      case DynamicAuthorizationFilterName.ASSIGNED_SITES_COMPANIES:
        dynamicFilter = new AssignedSitesCompaniesDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.SITES_ADMIN:
        dynamicFilter = new SitesAdminDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.SITES_OWNER:
        dynamicFilter = new SitesOwnerDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.ASSIGNED_SITES:
        dynamicFilter = new AssignedSitesDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.OWN_USER:
        dynamicFilter = new OwnUserDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
    }
    // Init Data Source
    if (dynamicFilter) {
      await DynamicAuthorizationFactory.initFilterDataSources(tenant, userToken, dynamicFilter, existingDataSources);
    }
    return dynamicFilter;
  }

  private static async initFilterDataSources(tenant: Tenant, user: UserToken,
      dynamicFilter: DynamicAuthorizationFilter,
      existingDataSources?: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>>): Promise<void> {
    // Get Data Source
    const dataSourceNames = dynamicFilter.getApplicableDataSources();
    for (const dataSourceName of dataSourceNames) {
      let dataSource = existingDataSources.get(dataSourceName);
      if (!dataSource) {
        // Create the data source
        dataSource = DynamicAuthorizationFactory.getDynamicDataSource(
          tenant, user, dataSourceName);
        // Load data
        await dataSource.loadData();
        // Add
        existingDataSources.set(dataSourceName, dataSource);
      }
      // Set
      dynamicFilter.setDataSource(dataSourceName, dataSource);
    }
  }

  private static getDynamicDataSource(tenant: Tenant, user: UserToken,
      dataSource: DynamicAuthorizationDataSourceName): DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData> {
    switch (dataSource) {
      case DynamicAuthorizationDataSourceName.ASSIGNED_SITES_COMPANIES:
        return new AssignedSitesCompaniesDynamicAuthorizationDataSource(tenant, user);
      case DynamicAuthorizationDataSourceName.SITES_ADMIN:
        return new SitesAdminDynamicAuthorizationDataSource(tenant, user);
      case DynamicAuthorizationDataSourceName.SITES_OWNER:
        return new SitesOwnerDynamicAuthorizationDataSource(tenant, user);
      case DynamicAuthorizationDataSourceName.ASSIGNED_SITES:
        return new AssignedSitesDynamicAuthorizationDataSource(tenant, user);
      case DynamicAuthorizationDataSourceName.OWN_USER:
        return new OwnUserDynamicAuthorizationDataSource(tenant, user);
    }
  }
}
