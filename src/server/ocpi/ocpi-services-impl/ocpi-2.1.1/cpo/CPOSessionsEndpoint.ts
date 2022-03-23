import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import Constants from '../../../../../utils/Constants';
import { DataResult } from '../../../../../types/DataResult';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPISession } from '../../../../../types/ocpi/OCPISession';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../../types/Tenant';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'CPOSessionsEndpoint';

export default class CPOSessionsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'sessions');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getSessionsRequest(req, res, next, tenant);
    }
  }

  private async getSessionsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    // Split URL Segments
    //    /ocpi/cpo/2.0/sessions/?date_from=xxx&date_to=yyy
    // date_from required
    // date_to optional
    // offset optional
    // limit optional
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < Constants.OCPI_RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : Constants.OCPI_RECORDS_LIMIT;
    if (!req.query.date_from) {
      throw new AppError({
        action: ServerAction.OCPI_CPO_PULL_SESSIONS,
        module: MODULE_NAME, method: 'getSessionsRequest',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Missing \'date_from\' parameter',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get all sessions
    const sessions = await this.getAllSessions(tenant, limit, offset,
      Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    // Set header
    res.set({
      'X-Total-Count': sessions.count,
      'X-Limit': Constants.OCPI_RECORDS_LIMIT
    });
    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, this.getBaseUrl(req), offset, limit, sessions.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }
    return OCPIUtils.success(sessions.result);
  }

  private async getAllSessions(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPISession>> {
    // Result
    const sessions: OCPISession[] = [];
    // Get all transactions
    const transactions = await TransactionStorage.getTransactions(tenant,
      { issuer: true, ocpiSessionDateFrom: dateFrom, ocpiSessionDateTo: dateTo },
      { limit, skip }, ['ocpiData']);
    for (const transaction of transactions.result) {
      sessions.push(transaction.ocpiData.session);
    }
    return {
      count: transactions.count,
      result: sessions
    };
  }
}
