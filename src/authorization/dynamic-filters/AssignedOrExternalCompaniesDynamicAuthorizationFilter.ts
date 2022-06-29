import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import AssignedOrExternalCompaniesDynamicAuthorizationDataSource from '../dynamic-data-source/AssignedOrExternalCompaniesDynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import Utils from '../../utils/Utils';

export default class AssignedOrExternalCompaniesDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    // Get Company IDs
    const assignedSitesCompaniesDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.ASSIGNED_OR_EXTERNAL_COMPANIES) as AssignedOrExternalCompaniesDynamicAuthorizationDataSource;
    const { companyIDs } = assignedSitesCompaniesDataSource.getData();
    // Clear
    authorizationFilters.filters.companyIDs = [];
    if (!Utils.isEmptyArray(companyIDs)) {
      // Force the filter
      authorizationFilters.filters.companyIDs = companyIDs;
      // Check if filter is provided
      if (Utils.objectHasProperty(extraFilters, 'CompanyID') &&
          !Utils.isNullOrUndefined(extraFilters['CompanyID'])) {
        const filteredCompanyIDs: string[] = extraFilters['CompanyID'].split('|');
        // Override
        authorizationFilters.filters.companyIDs = filteredCompanyIDs.filter(
          (companyID) => authorizationFilters.filters.companyIDs.includes(companyID));
      }
    }
    if (!Utils.isEmptyArray(authorizationFilters.filters.companyIDs)) {
      authorizationFilters.authorized = true;
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.COMPANY
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.ASSIGNED_OR_EXTERNAL_COMPANIES
    ];
  }
}
