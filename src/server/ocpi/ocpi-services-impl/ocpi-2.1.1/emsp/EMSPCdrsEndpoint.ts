import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPICdr } from '../../../../../types/ocpi/OCPICdr';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../../service/OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import Tenant from '../../../../../types/Tenant';
import Transaction from '../../../../../types/Transaction';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';

const MODULE_NAME = 'EMSPCdrsEndpoint';

export default class EMSPCdrsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'cdrs');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return this.getCdrRequest(req, res, next, tenant);
      case 'POST':
        return this.postCdrRequest(req, res, next, tenant);
    }
  }

  private async getCdrRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const id = urlSegment.shift();
    if (!id) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_GET_CDRS,
        module: MODULE_NAME, method: 'getCdrRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, id);
    if (!transaction) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_GET_CDRS,
        module: MODULE_NAME, method: 'getCdrRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for CDR ID '${id}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (!transaction.ocpiData?.cdr) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_GET_CDRS,
        module: MODULE_NAME, method: 'getCdrRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No CDR found in Transaction ID '${transaction.id}'`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR,
        detailedMessages: { transaction }
      });
    }
    return OCPIUtils.success(transaction.ocpiData.cdr);
  }

  private async postCdrRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const cdr: OCPICdr = req.body as OCPICdr;
    await OCPIUtilsService.processEmspCdr(tenant, cdr, ServerAction.OCPI_EMSP_CREATE_CDR);
    res.setHeader('Location', OCPIUtils.buildLocationUrl(req, this.getBaseUrl(req), cdr.id));
    return OCPIUtils.success({});
  }
}
