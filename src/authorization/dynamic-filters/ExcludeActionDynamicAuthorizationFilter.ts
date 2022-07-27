import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import Utils from '../../utils/Utils';

export default class ExcludeActionDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    authorizationFilters.authorized = false;
    Utils.removeSensibeDataFromEntity(extraFilters, entityData);
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.TAG
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [
      DynamicAuthorizationDataSourceName.EXCLUDE_ACTION
    ];
  }
}
