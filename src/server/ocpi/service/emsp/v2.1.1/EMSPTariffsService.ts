import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import { OCPITariff } from '../../../../../types/ocpi/OCPITariff';
import OCPIUtils from '../../../OCPIUtils';
import { PricingSettingsType } from '../../../../../types/Setting';
import { ServerAction } from '../../../../../types/Server';
import SettingStorage from '../../../../../storage/mongodb/SettingStorage';
import { StatusCodes } from 'http-status-codes';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'EMSPTariffsService';

export default class EMSPTariffsService {
  public static async handleGetTariff(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const tariffId = urlSegment.shift();
    if (!countryCode || !partyId || !tariffId) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetTariff', action,
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
        tariff = OCPIUtils.convertSimplePricingSettingToOcpiTariff(pricingSettings.simple);
      } else {
        throw new AppError({
          module: MODULE_NAME, method: 'handleGetTariff', action,
          errorCode: StatusCodes.NOT_FOUND,
          message: `Simple Pricing setting not found in Tenant ${Utils.buildTenantName(tenant)}`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    }
    res.json(OCPIUtils.success(tariff));
    next();
  }
}

