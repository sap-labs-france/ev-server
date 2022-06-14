import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import Utils from '../../utils/Utils';

export default class IncludeAllExternalSitesDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    authorizationFilters.filters.includeAllExternalSites = true;
    authorizationFilters.authorized = false;
    if (Utils.objectHasProperty(extraFilters, 'Issuer') &&
    !Utils.isNullOrUndefined(extraFilters['Issuer'])) {
      authorizationFilters.authorized = !extraFilters['Issuer'];
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.CHARGING_STATION, Entity.CONNECTOR
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.INCLUDE_ALL_EXTERNAL_SITES
    ];
  }
}
