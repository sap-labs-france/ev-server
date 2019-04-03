const OCPIUtils = require('../ocpi/OCPIUtils');
const Logging = require('../../utils/Logging');
const OCPIServerError = require('../../exception/OCPIClientError');
const OCPIClientError = require('../../exception/OCPIServerError');
const Constants = require('../../utils/Constants');

class OCPIErrorHandler {
  static async errorHandler(err, req, res, next) {
    let error;
    let detailedMessages = {};

    // check instance of error
    if (!( err instanceof OCPIServerError || err instanceof OCPIClientError ) ) {
      error = new OCPIServerError(
        '-',
        err.message, 500,
        'OCPI Server', `${req.method} ${req.originalUrl}`,Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR);
      detailedMessages = err.stack;

    } else {
      error = err;
    }

    // add logging
    Logging.logError({
      tenantID: req.tenantID,
      action: error.action,
      message: error.message,
      source: error.source,
      module: error.module,
      method: `${req.method} ${req.originalUrl}`,
      detailedMessages: detailedMessages
    });

    // return response with error
    res.status(error.httpErrorCode).json(OCPIUtils.error(error));

    next();
  }
}

module.exports = OCPIErrorHandler;