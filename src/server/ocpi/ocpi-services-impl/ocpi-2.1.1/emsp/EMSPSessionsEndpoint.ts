import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import { HTTPError } from '../../../../../types/HTTPError';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPISession } from '../../../../../types/ocpi/OCPISession';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../../types/Tenant';
import Transaction from '../../../../../types/Transaction';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';
import _ from 'lodash';

const MODULE_NAME = 'EMSPSessionsEndpoint';

export default class EMSPSessionsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'sessions');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return this.getSessionRequest(req, res, next, tenant);
      case 'PATCH':
        return this.patchSessionRequest(req, res, next, tenant);
      case 'PUT':
        return this.putSessionRequest(req, res, next, tenant);
    }
  }

  private async getSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();
    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_PULL_SESSIONS,
        module: MODULE_NAME, method: 'getSessionRequest',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, sessionId);
    if (!transaction) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_PULL_SESSIONS,
        module: MODULE_NAME, method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for OCPI Session ID ${sessionId}`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    return OCPIUtils.success(transaction.ocpiData.session);
  }

  private async putSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyID = urlSegment.shift();
    const sessionID = urlSegment.shift();
    if (!countryCode || !partyID || !sessionID) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_PUT_SESSION,
        module: MODULE_NAME, method: 'putSessionRequest',
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
        action: ServerAction.OCPI_EMSP_PUT_SESSION,
        module: MODULE_NAME, method: 'putSessionRequest',
        errorCode: StatusCodes.BAD_REQUEST,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        message: `Transaction ID '${session.id}' mismatch in URL`,
        detailedMessages: { sessionID, session }
      });
    }
    await OCPIUtilsService.updateTransaction(tenant, session, ServerAction.OCPI_EMSP_PUT_SESSION);
    return OCPIUtils.success({});
  }

  private async patchSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyID = urlSegment.shift();
    const sessionID = urlSegment.shift();
    if (!countryCode || !partyID || !sessionID) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_PATCH_SESSION,
        module: MODULE_NAME, method: 'patchSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, sessionID);
    if (!transaction) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_PATCH_SESSION,
        module: MODULE_NAME, method: 'patchSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Transaction not found with OCPI Session ID '${sessionID}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Merge
    _.merge(transaction.ocpiData.session, req.body);
    // Update
    await OCPIUtilsService.updateTransaction(tenant, transaction.ocpiData.session, ServerAction.OCPI_EMSP_PATCH_SESSION, transaction);
    return OCPIUtils.success({});
  }
}

