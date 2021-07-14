import DynamicAuthorizationAssert from '../DynamicAuthorizationAssert';
import { Entity } from '../../types/Authorization';
import { EntityDataType } from '../../types/GlobalType';

export default class OwnUserDynamicAuthorizationAssert extends DynamicAuthorizationAssert {
  public processAssert(entityData: EntityDataType): boolean {
    if (entityData && entityData['userID'] && entityData['userID'] === this.userToken.id) {
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
