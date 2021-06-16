import { DynamicAuthorizationDataSourceName, OwnUserDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';

export default class OwnUserDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<OwnUserDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.OWN_USER;
  }

  public async loadData(): Promise<void> {
    const ownUserData: OwnUserDynamicAuthorizationDataSourceData = {};
    // Get User ID
    ownUserData.userID = this.userToken.id;
    // Set
    this.setData(ownUserData);
    return Promise.resolve();
  }
}
