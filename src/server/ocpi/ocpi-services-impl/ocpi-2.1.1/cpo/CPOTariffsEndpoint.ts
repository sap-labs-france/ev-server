import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import Constants from '../../../../../utils/Constants';
import { HTTPError } from '../../../../../types/HTTPError';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import Tenant from '../../../../../types/Tenant';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'CPOTariffsEndpoint';

export default class CPOTariffsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'tariffs');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getTariffsRequest(req, res, next, tenant, ocpiEndpoint);
    }
  }

  private async getTariffsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < Constants.OCPI_RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : Constants.OCPI_RECORDS_LIMIT;
    // Get all tariffs
    const tariffs = await OCPIUtilsService.getAllTariffs(tenant, limit, offset, Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
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
      'X-Limit': Constants.OCPI_RECORDS_LIMIT
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
