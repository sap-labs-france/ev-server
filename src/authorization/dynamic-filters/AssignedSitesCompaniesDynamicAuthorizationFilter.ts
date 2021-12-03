import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';
import Utils from '../../utils/Utils';
import AssignedSitesCompaniesDynamicAuthorizationDataSource from '../dynamic-data-source/AssignedSitesCompaniesDynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';

export default class AssignedSitesCompaniesDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>): void {
    // Get Company IDs
    const assignedSitesCompaniesDataSource = this.getDataSource(
      DynamicAuthorizationDataSourceName.ASSIGNED_SITES_COMPANIES) as AssignedSitesCompaniesDynamicAuthorizationDataSource;
    const { companyIDs } = assignedSitesCompaniesDataSource.getData();
    // Clear
    authorizationFilters.filters.companyIDs = [];
    // Check
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
      DynamicAuthorizationDataSourceName.ASSIGNED_SITES_COMPANIES
    ];
  }
}
