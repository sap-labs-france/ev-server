import { DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName, DynamicAuthorizationFilterName } from '../types/Authorization';

import AssignedSitesCompaniesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesCompaniesDynamicAuthorizationDataSource';
import AssignedSitesCompaniesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesCompaniesDynamicAuthorizationFilter';
import DynamicAuthorizationDataSource from './DynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from './DynamicAuthorizationFilter';

export default class DynamicAuthorizationFactory {
  public static async getDynamicFilter(tenantID: string, userID: string,
      filter: DynamicAuthorizationFilterName,
      existingDataSources?: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>>):
      Promise<DynamicAuthorizationFilter> {
    let dynamicFilter: DynamicAuthorizationFilter;
    switch (filter) {
      case DynamicAuthorizationFilterName.ASSIGNED_SITES_COMPANIES:
        dynamicFilter = new AssignedSitesCompaniesDynamicAuthorizationFilter(tenantID, userID);
    }
    // Init Data Source
    if (dynamicFilter) {
      await DynamicAuthorizationFactory.initFilterDataSources(tenantID, userID, dynamicFilter, existingDataSources);
    }
    return dynamicFilter;
  }

  private static async initFilterDataSources(tenantID: string, userID: string,
      dynamicFilter: DynamicAuthorizationFilter,
      existingDataSources?: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>>): Promise<void> {
    // Get Data Source
    const dataSourceNames = dynamicFilter.getApplicableDataSources();
    for (const dataSourceName of dataSourceNames) {
      let dataSource = existingDataSources.get(dataSourceName);
      if (!dataSource) {
        // Create the data source
        dataSource = DynamicAuthorizationFactory.getDynamicDataSource(
          tenantID, userID, dataSourceName);
        // Load data
        await dataSource.loadData();
        // Add
        existingDataSources.set(dataSourceName, dataSource);
      }
      // Set
      dynamicFilter.setDataSource(dataSourceName, dataSource);
    }
  }

  private static getDynamicDataSource(tenantID: string, userID: string,
      dataSource: DynamicAuthorizationDataSourceName): DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData> {
    switch (dataSource) {
      case DynamicAuthorizationDataSourceName.ASSIGNED_SITES_COMPANIES:
        return new AssignedSitesCompaniesDynamicAuthorizationDataSource(tenantID, userID);
    }
  }
}
