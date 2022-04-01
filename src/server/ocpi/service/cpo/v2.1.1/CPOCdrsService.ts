import { NextFunction, Request, Response } from 'express';

import Constants from '../../../../../utils/Constants';
import { DataResult } from '../../../../../types/DataResult';
import { OCPICdr } from '../../../../../types/ocpi/OCPICdr';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import Tenant from '../../../../../types/Tenant';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';
import Utils from '../../../../../utils/Utils';

export default class CPOCdrsService {
  public static async handleGetCdrs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant, ocpiEndpoint } = req;
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < Constants.OCPI_RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : Constants.OCPI_RECORDS_LIMIT;
    // Get all cdrs
    const cdrs = await CPOCdrsService.getAllCdrs(tenant, limit, offset,
      Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    // Set header
    res.set({
      'X-Total-Count': cdrs.count,
      'X-Limit': Constants.OCPI_RECORDS_LIMIT
    });
    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, OCPIUtilsService.getBaseUrl(req), offset, limit, cdrs.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }
    res.json(OCPIUtils.success(cdrs.result));
    next();
  }

  private static async getAllCdrs(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPICdr>> {
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
