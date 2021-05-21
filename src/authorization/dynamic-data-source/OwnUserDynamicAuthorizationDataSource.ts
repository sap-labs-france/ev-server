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
    ownUserData.userID = await this.getOwnUserID();
    // Set
    this.setData(ownUserData);
  }

  private async getOwnUserID(): Promise<string> {
    return Promise.resolve(this.userToken.id);
  }
}
