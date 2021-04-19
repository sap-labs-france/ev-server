import { AuthorizationFilter, DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName, Entity } from '../types/Authorization';

import DynamicAuthorizationDataSource from './DynamicAuthorizationDataSource';
import Tenant from '../types/Tenant';
import UserToken from '../types/UserToken';

export default abstract class DynamicAuthorizationFilter {
  protected tenant: Tenant;
  protected userToken: UserToken;
  private dataSources: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>> = new Map();

  public constructor(tenant: Tenant, user: UserToken) {
    this.tenant = tenant;
    this.userToken = user;
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
