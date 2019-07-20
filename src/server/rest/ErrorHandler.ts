import HttpStatus from 'http-status-codes';
import AppAuthError from '../../exception/AppAuthError';
import AppError from '../../exception/AppError';
import BadRequestError from '../../exception/BadRequestError';
import ConflictError from '../../exception/ConflictError';
import Constants from '../../utils/Constants';
import NotFoundError from '../../exception/NotFoundError';
import Utils from '../../utils/Utils';

export default class ErrorHandler {
  static async errorHandler(err, req, res, next) {
    // Logging.logException(err, 'N/A', Constants.CENTRAL_SERVER, 'ErrorHandler', 'errorHandler', req.user.tenantID, req.user);
    if (err instanceof AppAuthError) {
      await ErrorHandler._handleUnauthorizedError(err, res);
    } else if (err instanceof BadRequestError) {
      await ErrorHandler._handleBadRequestError(err, res);
    } else if (err instanceof ConflictError) {
      await ErrorHandler._handleConflictError(err, res);
    } else if (err instanceof NotFoundError) {
      await ErrorHandler._handleNotFoundError(err, res);
    } else if (err instanceof AppError) {
      await ErrorHandler._handleAppError(err, res);
    } else {
      res.status(Constants.HTTP_GENERAL_ERROR).send({});
    }
    next();
  }

  static _handleAppError(err, res) {
    res.status((err.errorCode ? err.errorCode : Constants.HTTP_GENERAL_ERROR)).send({
      'message': Utils.hideShowMessage(err.message)
    });
  }

  static _handleUnauthorizedError(err, res) {
    res.status(HttpStatus.UNAUTHORIZED).send({});
  }

  static _handleBadRequestError(err, res) {
    res.status(HttpStatus.BAD_REQUEST).json({
      'message': err.message,
      'details': err.details ? err.details : []
    });
  }

  static _handleConflictError(err, res) {
    res.status(HttpStatus.CONFLICT).json({
      'message': err.messageKey,
      'params': err.messageParams
    });
  }

  static _handleNotFoundError(err, res) {
    res.status(HttpStatus.NOT_FOUND).json({});
  }
}

