import { DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName, DynamicAuthorizationFilterName } from '../types/Authorization';

import AssignedSitesCompaniesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesCompaniesDynamicAuthorizationDataSource';
import AssignedSitesCompaniesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesCompaniesDynamicAuthorizationFilter';
import AssignedSitesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesDynamicAuthorizationDataSource';
import AssignedSitesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesDynamicAuthorizationFilter';
import DynamicAuthorizationDataSource from './DynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from './DynamicAuthorizationFilter';
import SitesAdminDynamicAuthorizationDataSource from './dynamic-data-source/SitesAdminDynamicAuthorizationDataSource';
import SitesAdminDynamicAuthorizationFilter from './dynamic-filters/SitesAdminDynamicAuthorizationFilter';
import Tenant from '../types/Tenant';
import UserToken from '../types/UserToken';

export default class DynamicAuthorizationFactory {
  public static async getDynamicFilter(tenant: Tenant, userToken: UserToken,
      filter: DynamicAuthorizationFilterName,
      existingDataSources?: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>>):
      Promise<DynamicAuthorizationFilter> {
    let dynamicFilter: DynamicAuthorizationFilter;
    switch (filter) {
      case DynamicAuthorizationFilterName.ASSIGNED_SITES_COMPANIES:
        dynamicFilter = new AssignedSitesCompaniesDynamicAuthorizationFilter(tenant, userToken);
        break;
      case DynamicAuthorizationFilterName.ASSIGNED_SITES:
        dynamicFilter = new AssignedSitesDynamicAuthorizationFilter(tenant, userToken);
        break;
      case DynamicAuthorizationFilterName.SITES_ADMIN:
        dynamicFilter = new SitesAdminDynamicAuthorizationFilter(tenant, userToken);
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
      case DynamicAuthorizationDataSourceName.ASSIGNED_SITES:
        return new AssignedSitesDynamicAuthorizationDataSource(tenant, user);
      case DynamicAuthorizationDataSourceName.SITES_ADMIN:
        return new SitesAdminDynamicAuthorizationDataSource(tenant, user);
    }
  }
}
