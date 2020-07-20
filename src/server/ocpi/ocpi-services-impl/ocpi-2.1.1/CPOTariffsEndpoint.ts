import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOCPIService from '../../AbstractOCPIService';
import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import OCPIMapping from './OCPIMapping';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import Tenant from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';

const EP_IDENTIFIER = 'tariffs';
const MODULE_NAME = 'CPOTariffsEndpoint';

const RECORDS_LIMIT = 25;

/**
 * CPO Tariffs Endpoint
 */
export default class CPOTariffsEndpoint extends AbstractEndpoint {
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
        return await this.getTariffsRequest(req, res, next, tenant, ocpiEndpoint);
    }
  }

  /**
   * Get Tariffs
   *
   * /tariffs/?date_from=xxx&date_to=yyy&offset=zzz&limit=www
   *
   */
  private async getTariffsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : RECORDS_LIMIT;
    // Get all tariffs
    const tariffs = await OCPIMapping.getAllTariffs(tenant, limit, offset, Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    if (tariffs.count === 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'getTariffsRequest',
        action: ServerAction.OCPI_GET_TARIFFS,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'No tariffs found',
        ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
      });
    }
    // Set header
    res.set({
      'X-Total-Count': tariffs.count,
      'X-Limit': RECORDS_LIMIT
    });
    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, this.getBaseUrl(req), offset, limit, tariffs.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }
    return OCPIUtils.success(tariffs.result);
  }
}
