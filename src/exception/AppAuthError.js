const Utils = require('../utils/Utils');

class AppAuthError extends Error {
  constructor(user, action, entity, value, errorCode=500) {
    super(`Not authorised to perform '${action}' on ${entity} ${(value?"'"+value+"'":"")} (Role='${user.role}')`);
    this.user = user;
    this.action = action;
    this.entity = entity;
    this.value = value;
    this.errorCode = errorCode;
  }
}

module.exports = AppAuthError;
