import { AuthorizationFilter, Entity } from '../types/Authorization';

import Tenant from '../types/Tenant';
import UserToken from '../types/UserToken';

export default interface DynamicAuthorizationFilter {
  processFilter(tenant: Tenant, userToken: UserToken, authorizationFilters: AuthorizationFilter,
    extraFilters: Record<string, any>): Promise<void>;

  getEntities(): Entity[];

  getDataSources(): string[];
}
