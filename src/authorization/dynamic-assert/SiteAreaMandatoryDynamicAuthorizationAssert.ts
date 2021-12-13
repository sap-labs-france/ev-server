import DynamicAuthorizationAssert from '../DynamicAuthorizationAssert';
import { Entity } from '../../types/Authorization';
import { EntityData } from '../../types/GlobalType';

export default class SiteAreaMandatoryDynamicAuthorizationAssert extends DynamicAuthorizationAssert {
  public processAssert(entityData: EntityData): boolean {
    if (entityData['siteAreaID']) {
      return true;
    }
    return false;
  }

  public getApplicableEntities(): Entity[] {
    return [
      Entity.REGISTRATION_TOKEN
    ];
  }
}
