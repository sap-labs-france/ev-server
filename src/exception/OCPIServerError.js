const Constants = require('../utils/Constants');
class OCPIServerError extends Error {
  constructor(action, message, httpErrorCode = 500, module = "N/A", method = "N/A", ocpiError ) {
    super(message);
    this.action = action;
    this.source = 'OCPI Server';
    this.httpErrorCode = httpErrorCode;
    this.ocpiError= (ocpiError)?ocpiError:Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR;
    this.module = module;
    this.method = method;
  }
}

module.exports = OCPIServerError;