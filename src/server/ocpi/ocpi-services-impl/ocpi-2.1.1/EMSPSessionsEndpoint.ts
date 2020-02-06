import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import OCPIUtils from '../../OCPIUtils';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import { OCPISession } from '../../../../types/ocpi/OCPISession';
import Transaction from '../../../../types/Transaction';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import OCPISessionsService from './OCPISessionsService';
import HttpStatusCodes from 'http-status-codes';

const EP_IDENTIFIER = 'sessions';
const MODULE_NAME = 'EMSPSessionsEndpoint';
/**
 * EMSP Tokens Endpoint
 */
export default class EMSPSessionsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getSessionRequest(req, res, next, tenant);
      case 'PATCH':
        return await this.patchSessionRequest(req, res, next, tenant);
      case 'PUT':
        return await this.putSessionRequest(req, res, next, tenant);
    }
  }

  /**
   * Get the Session object from the eMSP system by its id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   *
   */
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
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, sessionId);
    if (!transaction) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No transaction found for ocpi session ${sessionId}`,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    return OCPIUtils.success(transaction.ocpiSession);
  }

  /**
   * Send a new/updated Session object.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
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
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'putSessionRequest',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const session: OCPISession = req.body as OCPISession;

    if (!session.id) {
      session.id = sessionId;
    } else if (session.id !== sessionId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'putSessionRequest',
        errorCode: HttpStatusCodes.BAD_REQUEST,
        message: `Session id ${session.id} does not match request parameter ${sessionId}`,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    await OCPISessionsService.updateSession(tenant.id, session);

    return OCPIUtils.success({});
  }

  /**
   * Update the Session object of id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
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
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, sessionId);
    if (!transaction) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No transaction found for ocpi session ${sessionId}`,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    let patched = false;

    const sessionPatched: Partial<OCPISession> = req.body as Partial<OCPISession>;
    if (sessionPatched.status) {
      transaction.ocpiSession.status = sessionPatched.status;
      patched = true;
    }
    if (sessionPatched.end_datetime) {
      transaction.ocpiSession.end_datetime = sessionPatched.end_datetime;
      patched = true;
    }
    if (sessionPatched.kwh) {
      transaction.ocpiSession.kwh = sessionPatched.kwh;
      patched = true;
    }
    if (sessionPatched.currency) {
      transaction.ocpiSession.currency = sessionPatched.currency;
      patched = true;
    }
    if (sessionPatched.total_cost) {
      transaction.ocpiSession.total_cost = sessionPatched.total_cost;
      patched = true;
    }

    if (!patched) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        detailedMessages: sessionPatched,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2002_NOT_ENOUGH_INFORMATION_ERROR
      });
    }

    await OCPISessionsService.updateSession(tenant.id, transaction.ocpiSession);
    return OCPIUtils.success({});
  }
}

