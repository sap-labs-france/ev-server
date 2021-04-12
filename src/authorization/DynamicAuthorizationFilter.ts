import { AuthorizationFilter, DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName, Entity } from '../types/Authorization';

import DynamicAuthorizationDataSource from './DynamicAuthorizationDataSource';

export default abstract class DynamicAuthorizationFilter {
  protected tenantID: string;
  protected userID: string;
  private dataSources: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>> = new Map();

  public constructor(tenantID: string, userID: string) {
    this.tenantID = tenantID;
    this.userID = userID;
  }

  public getDataSources(): DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>[] {
    return Array.from(this.dataSources.values());
  }

  public getDataSource(dataSourceName: DynamicAuthorizationDataSourceName): DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData> {
    return this.dataSources.get(dataSourceName);
  }

  public setDataSource(dataSourceName: DynamicAuthorizationDataSourceName,
      dataSource: DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>): void {
    this.dataSources.set(dataSourceName, dataSource);
  }

  public abstract processFilter(
    authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>): void;

  public abstract getApplicableEntities(): Entity[];

  public abstract getApplicableDataSources(): DynamicAuthorizationDataSourceName[];
}
