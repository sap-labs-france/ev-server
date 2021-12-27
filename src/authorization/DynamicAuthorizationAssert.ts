import { Entity } from '../types/Authorization';
import { EntityData } from '../types/GlobalType';
import Tenant from '../types/Tenant';
import UserToken from '../types/UserToken';

export default abstract class DynamicAuthorizationAssert {
  protected tenant: Tenant;
  protected userToken: UserToken;
  protected negateAssert: boolean;

  public constructor(tenant: Tenant, user: UserToken, negateAssert: boolean) {
    this.tenant = tenant;
    this.userToken = user;
    this.negateAssert = negateAssert;
  }

  public isNegateAssert(): boolean {
    return this.negateAssert;
  }

  public abstract processAssert(entityData: EntityData): boolean;

  public abstract getApplicableEntities(): Entity[];
}
