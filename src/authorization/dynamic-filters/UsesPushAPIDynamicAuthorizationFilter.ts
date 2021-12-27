import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import Utils from '../../utils/Utils';

export default class UsesPushAPIDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    authorizationFilters.authorized = true;
    if (Utils.objectHasProperty(entityData, 'usesPushAPI')) {
      // usesPushAPI has true value
      authorizationFilters.authorized = entityData['usesPushAPI'];
    }
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.ASSET
    ];
  }

  public getApplicableDataSources(): DynamicAuthorizationDataSourceName[] {
    return [];
  }
}
