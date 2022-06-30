import { AssignedSitesCompaniesDynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import _ from 'lodash';

export default class AssignedSitesCompaniesDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<AssignedSitesCompaniesDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.ASSIGNED_SITES_COMPANIES;
  }

  public async loadData(): Promise<void> {
    const assignedSitesCompaniesData: AssignedSitesCompaniesDynamicAuthorizationDataSourceData = {};
    // Get Company IDs from Site Admin flag
    assignedSitesCompaniesData.companyIDs = await this.getAssignedSitesCompanyIDs();
    // Set
    this.setData(assignedSitesCompaniesData);
  }

  private async getAssignedSitesCompanyIDs(): Promise<string[]> {
    // Get the Company IDs of the assigned Sites
    const sites = await SiteStorage.getSites(this.tenant,
      {
        userID: this.userToken.id,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['companyID']
    );
    return _.uniq(_.map(sites.result, 'companyID'));
  }
}
