import DynamicAuthorizationAssert from '../DynamicAuthorizationAssert';
import { Entity } from '../../types/Authorization';
import { EntityData } from '../../types/GlobalType';
import Tag from '../../types/Tag';

export default class UserMandatoryDynamicAuthorizationAssert extends DynamicAuthorizationAssert {
  public processAssert(entityData: EntityData): boolean {
    const tag = entityData as Tag;
    if (tag?.userID) {
      return true;
    }
    return false;
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.TAG
    ];
  }
}
