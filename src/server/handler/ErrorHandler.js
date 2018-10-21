const AppError = require('../../exception/AppError');
const AppAuthError = require('../../exception/AppAuthError');
const BadRequestError = require('../../exception/BadRequestError');
const ConflictError = require('../../exception/ConflictError');
const NotFoundError = require('../../exception/NotFoundError');
const UnauthorizedError = require('../../exception/UnauthorizedError');
const Utils = require('../../utils/Utils');
const HttpStatus = require('http-status-codes');

class ErrorHandler {
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
    const details = err.schemaErrors.map((error) => {
      return {
        path: error.dataPath,
        message: error.message
      }
    });

    res.status(HttpStatus.BAD_REQUEST).json({
      "message": err.message,
      "details": details
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

module.exports = ErrorHandler;