import { DynamicAuthorizationDataSourceName, OwnUserDynamicAuthorizationDataSourceData } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import TagStorage from '../../storage/mongodb/TagStorage';

export default class OwnUserDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<OwnUserDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.OWN_USER;
  }

  public async loadData(): Promise<void> {
    const ownUserData: OwnUserDynamicAuthorizationDataSourceData = {};
    // Get tags and user ID(s)
    const data = await this.getUserTagIDs();
    ownUserData.userID = data.userID;
    ownUserData.tagIDs = data.tagIDs;
    // Set
    this.setData(ownUserData);
    return Promise.resolve();
  }

  private async getUserTagIDs(): Promise<{ tagIDs: string[], userID: string }> {
    // Get the tag and user Ids
    const tags = await TagStorage.getTags(this.tenant,
      {
        userIDs: [this.userToken.id]
      }, 
      Constants.DB_PARAMS_DEFAULT_RECORD, 
      ['id']);
    return { tagIDs: tags.result.map((tag) => tag.id), userID: this.userToken.id };
  }
}
