import Utils from '../utils/Utils';

export default class AppAuthError extends Error {

	public user: any;
	public actionOnUser: any;
	public action: any;
	public entity: any;
	public value: any;
	public errorCode: any;
	public module: any;
	public method: any;

  constructor(action, entity, value, errorCode = 500, module = "N/A", method = "N/A", user?, actionOnUser?) {
    super(`Role ${Utils.getRoleNameFromRoleID(user.role)} is not authorized to perform ${action} on ${entity}${(value ? " '" + value + "'" : "")}`);
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
