import { AuthorizationFilter } from '../../types/Authorization';
import AuthorizationService from '../../server/rest/v1/service/AuthorizationService';
import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import UserToken from '../../types/UserToken';
import Utils from '../../utils/Utils';

export default class AssignedSitesCompaniesDynamicAuthorizationFilter implements DynamicAuthorizationFilter {
  public async processFilter(tenant: Tenant, userToken: UserToken,
      authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>): Promise<void> {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
      // Get Company IDs from Site Admin flag
      const companyIDs = await AuthorizationService.getAssignedSitesCompanyIDs(tenant.id, userToken);
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
    } else {
      authorizationFilters.authorized = true;
    }
  }
}
