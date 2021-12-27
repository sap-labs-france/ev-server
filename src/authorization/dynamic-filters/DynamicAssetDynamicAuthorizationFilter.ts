import { AuthorizationFilter, DynamicAuthorizationDataSourceName, Entity } from '../../types/Authorization';

import DynamicAuthorizationFilter from '../DynamicAuthorizationFilter';
import { EntityData } from '../../types/GlobalType';
import Utils from '../../utils/Utils';

export default class DynamicAssetDynamicAuthorizationFilter extends DynamicAuthorizationFilter {
  public processFilter(authorizationFilters: AuthorizationFilter, extraFilters: Record<string, any>, entityData?: EntityData): void {
    authorizationFilters.authorized = true;
    if (Utils.objectHasProperty(entityData, 'dynamicAsset')) {
      // Dynamic asset has true value
      authorizationFilters.authorized = entityData['dynamicAsset'];
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
