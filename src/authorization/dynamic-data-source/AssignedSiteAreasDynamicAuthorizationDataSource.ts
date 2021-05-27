import { AssignedSiteAreasDynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName } from '../../types/Authorization';

import Authorizations from '../Authorizations';
import Constants from '../../utils/Constants';
import DynamicAuthorizationDataSource from '../DynamicAuthorizationDataSource';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import _ from 'lodash';

export default class AssignedSiteAreasDynamicAuthorizationDataSource
  extends DynamicAuthorizationDataSource<AssignedSiteAreasDynamicAuthorizationDataSourceData> {

  public getName(): DynamicAuthorizationDataSourceName {
    return DynamicAuthorizationDataSourceName.ASSIGNED_SITE_AREAS;
  }

  public async loadData(): Promise<void> {
    const assignedSiteAreasData: AssignedSiteAreasDynamicAuthorizationDataSourceData = {};
    // Get SiteArea IDs
    assignedSiteAreasData.siteAreaIDs = await this.getAssignedSiteAreaIDs();
    // Set
    this.setData(assignedSiteAreasData);
  }

  private async getAssignedSiteAreaIDs(): Promise<string[]> {
    // Get the SiteArea IDs from Sites assigned to the user
    const sites = await SiteStorage.getSites(this.tenant.id,
      {
        userID: this.userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    const siteIDs = _.uniq(_.map(sites.result, 'id'));
    if (siteIDs.length !== 0) {
      const siteAreas = await SiteAreaStorage.getSiteAreas(this.tenant.id,
        {
          siteIDs: siteIDs,
          issuer: true,
        }, Constants.DB_PARAMS_MAX_LIMIT,
        ['id']
      );
      return _.uniq(_.map(siteAreas.result, 'id'));
    }
    return [null];
  }
}
