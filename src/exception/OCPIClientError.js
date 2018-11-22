const Constants = require('../utils/Constants');

class OCPIClientError extends Error {
  constructor(tenantID = 'default', action, message, httpErrorCode = 500, module = "N/A", method = "N/A", ocpiError) {
    super(message);
    this.tenantID = tenantID;
    this.action = action;
    this.source = 'OCPI Server';
    this.httpErrorCode = httpErrorCode;
    this.ocpiError= (ocpiError)?ocpiError:Constants.OCPI_STATUS_CODE.CODE_2000_GENERIC_CLIENT_ERROR;
    this.module = module;
    this.method = method;
  }
}

module.exports = OCPIClientError;