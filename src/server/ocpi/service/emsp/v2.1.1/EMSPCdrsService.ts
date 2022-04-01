import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPICdr } from '../../../../../types/ocpi/OCPICdr';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import Transaction from '../../../../../types/Transaction';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';

const MODULE_NAME = 'EMSPCdrsService';

export default class EMSPCdrsService {
  public static async handleGetCdr(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const id = urlSegment.shift();
    if (!id) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetCdr', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, id);
    if (!transaction) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetCdr', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for CDR ID '${id}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (!transaction.ocpiData?.cdr) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetCdr', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No CDR found in Transaction ID '${transaction.id}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { transaction }
      });
    }
    res.json(OCPIUtils.success(transaction.ocpiData.cdr));
    next();
  }

  public static async handlePostCdr(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const cdr: OCPICdr = req.body as OCPICdr;
    await OCPIUtilsService.processEmspCdr(tenant, cdr, action);
    res.setHeader('Location', OCPIUtils.buildLocationUrl(req, OCPIUtilsService.getBaseUrl(req), cdr.id));
    res.json(OCPIUtils.success({}));
    next();
  }
}
