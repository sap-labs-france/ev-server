import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import { HTTPError } from '../../../../../types/HTTPError';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import { OCPITariff } from '../../../../../types/ocpi/OCPITariff';
import OCPIUtils from '../../../OCPIUtils';
import { PricingSettingsType } from '../../../../../types/Setting';
import { ServerAction } from '../../../../../types/Server';
import SettingStorage from '../../../../../storage/mongodb/SettingStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../../types/Tenant';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'EMSPTariffsEndpoint';

export default class EMSPTariffsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'tariffs');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return this.getTariffRequest(req, res, next, tenant);
    }
  }

  private async getTariffRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tariffId = urlSegment.shift();
    if (!countryCode || !partyId || !tariffId) {
      throw new AppError({
        action: ServerAction.OCPI_EMSP_GET_TARIFF,
        module: MODULE_NAME, method: 'getTariffRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    let tariff: OCPITariff = {} as OCPITariff;
    if (tenant.components?.pricing?.active) {
      // Get simple pricing settings
      const pricingSettings = await SettingStorage.getPricingSettings(tenant);
      if (pricingSettings.type === PricingSettingsType.SIMPLE && pricingSettings.simple) {
        tariff = OCPIUtils.convertSimplePricingSetting2OCPITariff(pricingSettings.simple);
      } else {
        throw new AppError({
          module: MODULE_NAME, method: 'getTariffRequest',
          action: ServerAction.OCPI_EMSP_GET_TARIFF,
          errorCode: StatusCodes.BAD_REQUEST,
          message: `Simple Pricing setting not found in Tenant ${Utils.buildTenantName(tenant)}`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    }
    return OCPIUtils.success(tariff);
  }
}

