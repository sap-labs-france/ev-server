import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPISession } from '../../../../../types/ocpi/OCPISession';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Transaction from '../../../../../types/Transaction';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';
import _ from 'lodash';

const MODULE_NAME = 'EMSPSessionsService';

export default class EMSPSessionsService {
  public static async handleGetSession(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();
    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetSession', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, sessionId);
    if (!transaction) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetSession', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for OCPI Session ID ${sessionId}`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    res.json(OCPIUtils.success(transaction.ocpiData.session));
    next();
  }

  public static async handlePutSession(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyID = urlSegment.shift();
    const sessionID = urlSegment.shift();
    if (!countryCode || !partyID || !sessionID) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutSession', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const session = req.body as OCPISession;
    if (!session.id) {
      session.id = sessionID;
    } else if (session.id !== sessionID) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutSession', action,
        errorCode: StatusCodes.BAD_REQUEST,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        message: `OCPI Session ID '${session.id}' mismatch in URL`,
        detailedMessages: { sessionID, session }
      });
    }
    await OCPIUtilsService.processEmspTransactionFromSession(tenant, session, ServerAction.OCPI_EMSP_UPDATE_SESSION);
    res.json(OCPIUtils.success({}));
    next();
  }

  public static async handlePatchSession(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyID = urlSegment.shift();
    const sessionID = urlSegment.shift();
    if (!countryCode || !partyID || !sessionID) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchSession', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, sessionID, { withUser: true });
    if (!transaction) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchSession', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Transaction not found with OCPI Session ID '${sessionID}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Merge
    _.merge(transaction.ocpiData.session, req.body);
    // Update
    await OCPIUtilsService.processEmspTransactionFromSession(tenant, transaction.ocpiData.session, ServerAction.OCPI_EMSP_UPDATE_SESSION, transaction, transaction.user);
    res.json(OCPIUtils.success({}));
    next();
  }
}

