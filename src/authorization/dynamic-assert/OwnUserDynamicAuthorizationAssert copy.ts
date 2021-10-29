import DynamicAuthorizationAssert from '../DynamicAuthorizationAssert';
import { Entity } from '../../types/Authorization';
import { EntityDataType } from '../../types/GlobalType';
import SiteStorage from '../../storage/mongodb/SiteStorage';

export default class OwnUserDynamicAuthorizationAssert extends DynamicAuthorizationAssert {
  public processAssert(entityData: EntityDataType): boolean {
    if (entityData && entityData['id']) {
      const site = SiteStorage.getSite(this.tenant,entityData['id'] as string);
      return true;
    }
    return false;
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.CAR
    ];
  }
}
