import AssignedSitesCompaniesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesCompaniesDynamicAuthorizationFilter';
import DynamicAuthorizationFilter from './DynamicAuthorizationFilter';
import { DynamicAuthorizationFilters } from '../types/Authorization';

export default class DynamicAuthorizationFilterFactory {
  public static getDynamicFilter(filter: DynamicAuthorizationFilters): DynamicAuthorizationFilter {
    switch (filter) {
      case DynamicAuthorizationFilters.ASSIGNED_SITES_COMPANIES:
        return new AssignedSitesCompaniesDynamicAuthorizationFilter();
    }
  }
}
