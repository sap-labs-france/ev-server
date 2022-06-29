import { AssignedOrExternalCompaniesDynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../../types/Authorization';

import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import _ from 'lodash';

export default class AssignedOrExternalCompaniesDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<AssignedOrExternalCompaniesDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.ASSIGNED_OR_EXTERNAL_COMPANIES;
  }

  public async loadData(): Promise<void> {
    const assignedSitesCompaniesData: AssignedOrExternalCompaniesDynamicAuthorizationDataSourceData = {};
    // Get Company IDs from Site Admin flag
    assignedSitesCompaniesData.companyIDs = await this.getAssignedSitesCompanyIDs();
    // Set
    this.setData(assignedSitesCompaniesData);
  }

  private async getAssignedSitesCompanyIDs(): Promise<string[]> {
    // Get the Company IDs of the assigned Sites
    const companyIDs = await SiteStorage.getSites(this.tenant,
      {
        userID: this.userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['companyID']
    );

    const externalCompanyIDs = await SiteStorage.getSites(this.tenant,
      {
        issuer: false,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['companyID']
    );
    return _.uniq(_.map([...companyIDs.result, ...externalCompanyIDs.result], 'companyID'));
  }
}
