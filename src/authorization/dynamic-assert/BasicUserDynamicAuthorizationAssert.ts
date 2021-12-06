import User, { UserRole } from '../../types/User';

import DynamicAuthorizationAssert from '../DynamicAuthorizationAssert';
import { Entity } from '../../types/Authorization';
import { EntityData } from '../../types/GlobalType';

export default class BasicUserDynamicAuthorizationAssert extends DynamicAuthorizationAssert {
  public processAssert(entityData: EntityData): boolean {
    const user = entityData as User;
    if (user.role === UserRole.BASIC) {
      return true;
    }
    return false;
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.USER
    ];
  }
}
