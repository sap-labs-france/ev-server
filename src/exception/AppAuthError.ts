import User from '../types/User';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';

export default class AppAuthError extends Error {

  constructor(readonly params: {
    action: string; entity: string; value?: string; errorCode: number; module: string;
    method: string; user: UserToken | User; actionOnUser?: User | UserToken | string;
  }) {
    super(`Role ${Utils.getRoleNameFromRoleID(params.user.role)} is not authorized to perform ${params.action} on ${params.entity}${(params.value ? ' \'' + params.value + '\'' : '')}`);
  }
}
