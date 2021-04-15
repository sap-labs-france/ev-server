import { AssignedSitesDynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import _ from 'lodash';

export default class AssignedSitesDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<AssignedSitesDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.ASSIGNED_SITES;
  }

  public async loadData(): Promise<void> {
    const assignedSitesCompaniesData: AssignedSitesDynamicAuthorizationDataSourceData = {};
    // Get Site IDs from Site Admin flag
    assignedSitesCompaniesData.siteIDs = await this.getAssignedSiteIDs();
    // Set
    this.setData(assignedSitesCompaniesData);
  }

  private async getAssignedSiteIDs(): Promise<string[]> {
    // Get the Site IDs of the assigned Sites
    const sites = await SiteStorage.getSites(this.tenant.id,
      {
        userID: this.userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return _.uniq(_.map(sites.result, 'id'));
  }
}
