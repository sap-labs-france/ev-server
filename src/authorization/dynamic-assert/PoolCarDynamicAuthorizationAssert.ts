import { Car, CarType } from '../../types/Car';

import DynamicAuthorizationAssert from '../DynamicAuthorizationAssert';
import { Entity } from '../../types/Authorization';
import { EntityDataType } from '../../types/GlobalType';

export default class PoolCarDynamicAuthorizationAssert extends DynamicAuthorizationAssert {
  public processAssert(entityData: EntityDataType): boolean {
    const car = entityData as Car;
    if (car?.type === CarType.POOL_CAR) {
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
