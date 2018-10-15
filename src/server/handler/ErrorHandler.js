import {
    logActionExceptionMessage
} from '../../utils/Logging';
import AppError from '../../exception/AppError';
import AppAuthError from '../../exception/AppAuthError';
import ConflictError from '../../exception/ConflictError';
import BadRequestError from '../../exception/BadRequestError';
import {
    hideShowMessage
} from '../../utils/Utils';
import {
    UNAUTHORIZED,
    BAD_REQUEST,
    CONFLICT
} from 'http-status-codes';

export function errorHandler(err, req, res, next) {
    logActionExceptionMessage(err.action, err);
    if (err instanceof AppAuthError) {
        _handleAppAuthError(err, res);
    } else if (err instanceof BadRequestError) {
        _handleBadRequestError(err, res);
    } else if (err instanceof ConflictError) {
        _handleConflictError(err, res);
    } else if (err instanceof AppError) {
        _handleAppError(err, res);
    } else {
        res.status(500).send({});
    }
    next(err);
}

function _handleAppError(err, res) {
    res.status((err.errorCode ? err.errorCode : 500)).send({
        "message": hideShowMessage(exception.message)
    });
}

function _handleAppAuthError(err, res) {
    res.status(UNAUTHORIZED).send({});
}

function _handleBadRequestError(err, res) {
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

function _handleConflictError(err, res) {
    res.status(CONFLICT).json({
        "message": err.messageKey,
        "params": err.messageParams
    });
}