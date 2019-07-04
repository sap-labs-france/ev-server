import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPIServerError from '../../exception/OCPIClientError';
import OCPIClientError from '../../exception/OCPIServerError';
import OCPIUtils from '../ocpi/OCPIUtils';

export default class OCPIErrorHandler {
  static async errorHandler(err, req?, res?, next?) {
    let error;
    let detailedMessages = null;

    // Check instance of error
    if (!(err instanceof OCPIServerError || err instanceof OCPIClientError)) {
      error = new OCPIServerError(
        '-',
        err.message, Constants.HTTP_GENERAL_ERROR,
        'OCPIErrorHandler', `${req.method} ${req.originalUrl}`, Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR);
      detailedMessages = err.stack;
    } else {
      error = err;
      detailedMessages = err['detailedMessages'];
    }

    // Add logging
    Logging.logError({
      tenantID: req.user.tenantID,
      action: error.action,
      message: error.message,
      source: error.source,
      module: error.module,
      method: `${req.method} ${req.originalUrl}`,
      detailedMessages: detailedMessages
    });

    // Return response with error
    await res.status(error.httpErrorCode).json(OCPIUtils.error(error));

    next();
  }
}

