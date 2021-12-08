import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import Utils from '../../utils/Utils';

export default class LocalIssuerDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    authorizationFilters.filters.issuer = true;
    authorizationFilters.authorized = true;
    if (Utils.objectHasProperty(entityData, 'issuer')) {
      // Local issuer has true value
      authorizationFilters.authorized = entityData['issuer'];
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.TAG
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [];
  }
}
