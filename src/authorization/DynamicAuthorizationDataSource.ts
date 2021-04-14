import { DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../types/Authorization';

import Tenant from '../types/Tenant';
import UserToken from '../types/UserToken';

export default abstract class DynamicAuthorizationDataSource<T extends DynamicAuthorizationDataSourceData> {
  protected tenant: Tenant;
  protected userToken: UserToken;
  private dataSourceData: T;

  public constructor(tenant: Tenant, user: UserToken) {
    this.tenant = tenant;
    this.userToken = user;
  }

  public setData(dataSourceData: T): void {
    this.dataSourceData = dataSourceData;
  }

  public getData(): T {
    return this.dataSourceData;
  }

  public abstract getName(): DynamicAuthorizationDataSourceName;

  public abstract loadData(): Promise<void>;
}
