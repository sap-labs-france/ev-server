import DynamicAuthorizationAssert from '../DynamicAuthorizationAssert';
import { Entity } from '../../types/Authorization';
import { EntityData } from '../../types/GlobalType';

export default class OwnUserDynamicAuthorizationAssert extends DynamicAuthorizationAssert {
  public processAssert(entityData: EntityData): boolean {
    if (entityData && entityData['userID'] && entityData['userID'] === this.userToken.id) {
      return true;
    }
    if (entityData && entityData['user'] && entityData['user']['id'] && entityData['user']['id'] === this.userToken.id) {
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
