import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';

export default class LocalIssuerDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>): void {
    authorizationFilters.filters.issuer = true;
    authorizationFilters.authorized = true;
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.TAGS
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [];
  }
}
