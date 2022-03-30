import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import Constants from '../../../../../utils/Constants';
import { DataResult } from '../../../../../types/DataResult';
import { OCPICdr } from '../../../../../types/ocpi/OCPICdr';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import OCPIUtils from '../../../OCPIUtils';
import Tenant from '../../../../../types/Tenant';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';
import Utils from '../../../../../utils/Utils';

export default class CPOCdrsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'cdrs');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return this.getCdrsRequest(req, res, next, tenant);
    }
  }

  private async getCdrsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < Constants.OCPI_RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : Constants.OCPI_RECORDS_LIMIT;
    // Get all cdrs
    const cdrs = await this.getAllCdrs(tenant, limit, offset,
      Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    // Set header
    res.set({
      'X-Total-Count': cdrs.count,
      'X-Limit': Constants.OCPI_RECORDS_LIMIT
    });
    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, this.getBaseUrl(req), offset, limit, cdrs.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }
    return OCPIUtils.success(cdrs.result);
  }

  private async getAllCdrs(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPICdr>> {
    // Get all transactions
    const transactions = await TransactionStorage.getTransactions(tenant,
      { issuer: true, ocpiCdrDateFrom: dateFrom, ocpiCdrDateTo: dateTo, ocpiCdrChecked: true },
      { limit, skip }, ['ocpiData']
    );
    return {
      count: transactions.count,
      result: transactions.result.map(
        (transaction) => transaction.ocpiData?.cdr)
    };
  }
}
