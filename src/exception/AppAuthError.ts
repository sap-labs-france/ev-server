import Constants from '../utils/Constants';
import Utils from '../utils/Utils';
import User from '../types/User';
import UserToken from '../types/UserToken';

export default class AppAuthError extends Error {
  public user: UserToken|User;
  public actionOnUser: UserToken|User|string;
  public action: any;
  public entity: any;
  public value: any;
  public errorCode: any;
  public module: any;
  public method: any;

  constructor(action, entity, value, errorCode = Constants.HTTP_GENERAL_ERROR, module = 'N/A', method = 'N/A', user?: UserToken|User, actionOnUser?: User|UserToken|string) {
    super(`Role ${Utils.getRoleNameFromRoleID(user.role)} is not authorized to perform ${action} on ${entity}${(value ? ' \'' + value + '\'' : '')}`);
    this.user = user;
    this.actionOnUser = actionOnUser;
    this.action = action;
    this.entity = entity;
    this.value = value;
    this.errorCode = errorCode;
    this.module = module;
    this.method = method;
  }
}
