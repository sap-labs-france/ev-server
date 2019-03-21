
class AppAuthError extends Error {
  constructor(action, entity, value, errorCode=500, module="N/A", method="N/A", user, actionOnUser) {
    super(`Not authorized to perform '${action}' on '${entity}' ${(value?"'"+value+"' ":" ")}(Role='${user.role}')`);
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

module.exports = AppAuthError;
