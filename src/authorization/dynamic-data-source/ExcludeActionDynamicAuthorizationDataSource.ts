import { DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../../types/Authorization';

import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import { Promise } from 'bluebird';

export default class ExcludeActionDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.EXCLUDE_ACTION;
  }

  public async loadData(): Promise<void> {
    const sourceData: DynamicAuthorizationDataSourceData = {};
    // Set
    this.setData(sourceData);
    return Promise.resolve();
  }
}
