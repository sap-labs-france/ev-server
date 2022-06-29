import { AssignedOrExternalSitesDynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import _ from 'lodash';

export default class AssignedOrExternalSitesDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<AssignedOrExternalSitesDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.ASSIGNED_OR_EXTERNAL_COMPANIES;
  }

  public async loadData(): Promise<void> {
    const assignedSitesData: AssignedOrExternalSitesDynamicAuthorizationDataSourceData = {};
    // Get Site IDs from Site Admin flag
    assignedSitesData.siteIDs = await this.getAssignedOrExternalSiteIDs();
    // Set
    this.setData(assignedSitesData);
  }

  private async getAssignedOrExternalSiteIDs(): Promise<string[]> {
    // Get the Site IDs of the assigned Sites
    const assignedSitesIds = await SiteStorage.getSites(this.tenant,
      {
        userID: this.userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    // Get the Site IDs of external sites
    const externalSitesIds = await SiteStorage.getSites(this.tenant,
      {
        issuer: false,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return _.uniq(_.map([...assignedSitesIds.result, ... externalSitesIds.result] , 'id'));
  }
}
