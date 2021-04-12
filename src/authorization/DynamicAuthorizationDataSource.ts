import { DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../types/Authorization';

export default abstract class DynamicAuthorizationDataSource<T extends DynamicAuthorizationDataSourceData> {
  protected tenantID: string;
  protected userID: string;
  private dataSourceData: T;

  public constructor(tenantID: string, userID: string) {
    this.tenantID = tenantID;
    this.userID = userID;
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
