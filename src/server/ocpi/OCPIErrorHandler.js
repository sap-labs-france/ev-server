const OCPIUtils = require('../ocpi/OCPIUtils');
const Logging = require('../../utils/Logging');

class OCPIErrorHandler {
  static async errorHandler(err, req, res, next) {
    // add logging
    Logging.logError({
      tenantID: err.tenantID,
      action: err.action,
      message: err.message,
      source: err.source,
      module: err.module,
      method: err.method,
      detailedMessages: {}
    });

    // return response with error
    res.status(err.httpErrorCode).json(OCPIUtils.error(err));

    next();
  }








}

module.exports = OCPIErrorHandler;