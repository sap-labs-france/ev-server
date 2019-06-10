import AppError from '../../exception/AppError';
import AppAuthError from '../../exception/AppAuthError';
import BadRequestError from '../../exception/BadRequestError';
import ConflictError from '../../exception/ConflictError';
import NotFoundError from '../../exception/NotFoundError';
import UnauthorizedError from '../../exception/UnauthorizedError';
import Utils from '../../utils/Utils';
import HttpStatus from 'http-status-codes';

export default class ErrorHandler {
  static async errorHandler(err, req, res, next) {
    if (err instanceof AppAuthError || err instanceof UnauthorizedError) {
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
      res.status(500).send({});
    }
    next();
  }

  static async _handleAppError(err, res) {
    res.status((err.errorCode ? err.errorCode : 500)).send({
      "message": Utils.hideShowMessage(err.message)
    });
  }

  static async _handleUnauthorizedError(err, res) {
    res.status(HttpStatus.UNAUTHORIZED).send({});
  }

  static async _handleBadRequestError(err, res) {
    res.status(HttpStatus.BAD_REQUEST).json({
      "message": err.message,
      "details": err.details ? err.details : []
    });
  }

  static async _handleConflictError(err, res) {
    res.status(HttpStatus.CONFLICT).json({
      "message": err.messageKey,
      "params": err.messageParams
    });
  }

  static async _handleNotFoundError(err, res) {
    res.status(HttpStatus.NOT_FOUND).json({});
  }
}

