import { Action, Entity } from '../types/Authorization';
import User, { UserRole } from '../types/User';

import { HTTPAuthError } from '../types/HTTPError';
import TenantComponents from '../types/TenantComponents';
import UserToken from '../types/UserToken';

export default class AppAuthError extends Error {

  constructor(readonly params: {
    action: Action;
    entity: Entity;
    value?: string;
    errorCode: HTTPAuthError;
    module: string;
    method: string;
    user: UserToken;
    inactiveComponent?: TenantComponents,
    actionOnUser?: User | UserToken | string;
  }) {
    super(`${params.inactiveComponent ? 'Component \'' + params.inactiveComponent + '\' is not active - ' : ''}Role ${AppAuthError.getRoleNameFromRoleID(params.user.role)} is not authorized to perform ${params.action} on ${params.entity}${(params.value ? ' \'' + params.value + '\'' : '')}`);
  }

  // Break circular deps with Utils
  // src/exception/AppAuthError.ts -> src/utils/Utils.ts -> src/storage/mongodb/TenantStorage.ts -> src/utils/Logging.ts -> src/exception/AppAuthError.ts
  private static getRoleNameFromRoleID(roleID: string): string {
    switch (roleID) {
      case UserRole.BASIC:
        return 'Basic';
      case UserRole.DEMO:
        return 'Demo';
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      default:
        return 'Unknown';
    }
  }
}

