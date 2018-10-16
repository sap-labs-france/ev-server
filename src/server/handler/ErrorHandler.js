const AppError = require('../../exception/AppError');
const AppAuthError = require('../../exception/AppAuthError');
const BadRequestError = require('../../exception/BadRequestError');
const ConflictError = require('../../exception/ConflictError');
const NotFoundError = require('../../exception/NotFoundError');
const {
    hideShowMessage
} = require('../../utils/Utils');
const {
    UNAUTHORIZED,
    BAD_REQUEST,
    CONFLICT,
    NOT_FOUND
} = require('http-status-codes');

class ErrorHandler {
    static async errorHandler(err, req, res, next) {
        if (err instanceof AppAuthError) {
            ErrorHandler._handleAppAuthError(err, res);
        } else if (err instanceof BadRequestError) {
            ErrorHandler._handleBadRequestError(err, res);
        } else if (err instanceof ConflictError) {
            ErrorHandler._handleConflictError(err, res);
        } else if (err instanceof NotFoundError) {
            ErrorHandler._handleNotFoundError(err, res);
        } else if (err instanceof AppError) {
            ErrorHandler._handleAppError(err, res);
        } else {
            res.status(500).send({});
        }
        next();
    }

    static async _handleAppError(err, res) {
        res.status((err.errorCode ? err.errorCode : 500)).send({
            "message": hideShowMessage(exception.message)
        });
    }

    static async _handleAppAuthError(err, res) {
        res.status(UNAUTHORIZED).send({});
    }

    static async _handleBadRequestError(err, res) {
        let details = err.schemaErrors.map((error) => {
            return {
                path: error.dataPath,
                message: error.message
            }
        });

        res.status(BAD_REQUEST).json({
            "message": err.message,
            "details": details
        });
    }

    static async _handleConflictError(err, res) {
        res.status(CONFLICT).json({
            "message": err.messageKey,
            "params": err.messageParams
        });
    }

    static async _handleNotFoundError(err, res) {
        res.status(NOT_FOUND).json({});
    }
}

module.exports = ErrorHandler;
