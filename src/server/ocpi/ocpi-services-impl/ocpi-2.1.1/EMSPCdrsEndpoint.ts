import { NextFunction, Request, Response } from 'express';
import AppError from '../../../../exception/AppError';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import { HTTPError } from '../../../../types/HTTPError';
import { OCPICdr } from '../../../../types/ocpi/OCPICdr';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPILocation } from '../../../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import Tenant from '../../../../types/Tenant';
import Transaction from '../../../../types/Transaction';
import Constants from '../../../../utils/Constants';
import AbstractOCPIService from '../../AbstractOCPIService';
import OCPIUtils from '../../OCPIUtils';
import AbstractEndpoint from '../AbstractEndpoint';
import OCPISessionsService from './OCPISessionsService';

const EP_IDENTIFIER = 'cdrs';
const MODULE_NAME = 'EMSPCdrsEndpoint';

/**
 * EMSP Cdrs Endpoint
 */
export default class EMSPCdrsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getCdrRequest(req, res, next, tenant);
      case 'POST':
        return await this.postCdrRequest(req, res, next, tenant);
    }
  }

  /**
   * Get the Cdr object from the eMSP system by its id {cdr_id}.
   *
   * /cdrs/{cdr_id}
   *
   */
  private async getCdrRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const id = urlSegment.shift();
    if (!id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'getSessionRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, id);
    if (!transaction || !transaction.ocpiCdr) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'postCdrRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The CDR ${id} does not exist or does not belong to the requester`,
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    return OCPIUtils.success(transaction.ocpiCdr);
  }

  /**
   * Post a new cdr object.
   *
   * /cdrs/
   */
  private async postCdrRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const cdr: OCPICdr = req.body as OCPICdr;

    await OCPISessionsService.processCdr(tenant.id, cdr);

    res.setHeader('Location', OCPIUtils.buildLocationUrl(req, this.getBaseUrl(req), cdr.id));
    return OCPIUtils.success({});
  }
}
