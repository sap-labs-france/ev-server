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

const MODULE_NAME = 'EMSPSessionsEndpoint';

export default class EMSPSessionsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'sessions');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getSessionRequest(req, res, next, tenant);
      case 'PATCH':
        return await this.patchSessionRequest(req, res, next, tenant);
      case 'PUT':
        return await this.putSessionRequest(req, res, next, tenant);
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
        action: ServerAction.OCPI_PULL_SESSIONS,
        module: MODULE_NAME, method: 'getSessionRequest',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, sessionId);
    if (!transaction) {
      throw new AppError({
        action: ServerAction.OCPI_PULL_SESSIONS,
        module: MODULE_NAME, method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for ocpi session ${sessionId}`,
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
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();
    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        action: ServerAction.OCPI_PUT_SESSION,
        module: MODULE_NAME, method: 'putSessionRequest',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const session: OCPISession = req.body as OCPISession;
    if (!session.id) {
      session.id = sessionId;
    } else if (session.id !== sessionId) {
      throw new AppError({
        action: ServerAction.OCPI_PUT_SESSION,
        module: MODULE_NAME, method: 'putSessionRequest',
        errorCode: StatusCodes.BAD_REQUEST,
        message: `Transaction ID '${session.id}' does not match request parameter '${sessionId}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    await OCPIUtilsService.updateTransaction(tenant, session);
    return OCPIUtils.success({});
  }

  private async patchSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();
    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_SESSION,
        module: MODULE_NAME, method: 'patchSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, sessionId);
    if (!transaction) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_SESSION,
        module: MODULE_NAME, method: 'patchSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for OCPI Transaction ID '${sessionId}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    let patched = false;
    const sessionPatched: Partial<OCPISession> = req.body as Partial<OCPISession>;
    if (sessionPatched.status) {
      transaction.ocpiData.session.status = sessionPatched.status;
      patched = true;
    }
    if (sessionPatched.end_datetime) {
      transaction.ocpiData.session.end_datetime = sessionPatched.end_datetime;
      patched = true;
    }
    if (sessionPatched.kwh) {
      transaction.ocpiData.session.kwh = sessionPatched.kwh;
      patched = true;
    }
    if (sessionPatched.currency) {
      transaction.ocpiData.session.currency = sessionPatched.currency;
      patched = true;
    }
    if (sessionPatched.total_cost) {
      transaction.ocpiData.session.total_cost = sessionPatched.total_cost;
      patched = true;
    }
    if (!patched) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_SESSION,
        module: MODULE_NAME, method: 'patchSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        detailedMessages: { sessionPatched },
        ocpiError: OCPIStatusCode.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR
      });
    }
    await OCPIUtilsService.updateTransaction(tenant, transaction.ocpiData.session);
    return OCPIUtils.success({});
  }
}

