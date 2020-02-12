import { Action, Entity } from '../types/Authorization';
import { HTTPAuthError } from '../types/HTTPError';
import User from '../types/User';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';

export default class AppAuthError extends Error {

  constructor(readonly params: {
    action: Action; entity: Entity; value?: string; errorCode: HTTPAuthError; module: string;
    method: string; user: UserToken; actionOnUser?: User | UserToken | string;
  }) {
    super(`Role ${Utils.getRoleNameFromRoleID(params.user.role)} is not authorized to perform ${params.action} on ${params.entity}${(params.value ? ' \'' + params.value + '\'' : '')}`);
  }
}
