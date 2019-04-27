
class OrganizationComponentInactiveError extends Error {
  constructor(action, entity, errorCode = 500, module = "N/A", method = "N/A") {
    super(`Component Organization inactive - not allowed to perform '${action}' on '${entity}'`);
    this.action = action;
    this.entity = entity;
    this.errorCode = errorCode;
    this.module = module;
    this.method = method;
  }
}

module.exports = OrganizationComponentInactiveError;
