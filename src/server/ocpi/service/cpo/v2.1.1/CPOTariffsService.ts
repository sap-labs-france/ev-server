import { NextFunction, Request, Response } from 'express';
import { OCPITariff, OCPITariffDimensionType } from '../../../../../types/ocpi/OCPITariff';
import { PricingSettings, PricingSettingsType } from '../../../../../types/Setting';

import AppError from '../../../../../exception/AppError';
import Constants from '../../../../../utils/Constants';
import { DataResult } from '../../../../../types/DataResult';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import SettingStorage from '../../../../../storage/mongodb/SettingStorage';
import Tenant from '../../../../../types/Tenant';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'CPOTariffsService';

export default class CPOTariffsService {
  public static async handleGetTariffs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant } = req;
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < Constants.OCPI_RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : Constants.OCPI_RECORDS_LIMIT;
    // Get all tariffs
    const tariffs = await CPOTariffsService.getAllTariffs(tenant, limit, offset, Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    if (tariffs.count === 0) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleGetTariffs', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'No OCPI Tariffs found',
        ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
      });
    }
    // Set header
    res.set({
      'X-Total-Count': tariffs.count,
      'X-Limit': Constants.OCPI_RECORDS_LIMIT
    });
    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, OCPIUtilsService.getBaseUrl(req), offset, limit, tariffs.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }
    res.json(OCPIUtils.success(tariffs.result));
    next();
  }

  private static async getAllTariffs(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPITariff>> {
    // Result
    const tariffs: OCPITariff[] = [];
    let tariff: OCPITariff;
    if (tenant.components?.pricing?.active) {
      // Get simple pricing settings
      const pricingSettings = await SettingStorage.getPricingSettings(tenant, limit, skip, dateFrom, dateTo);
      if (pricingSettings.type === PricingSettingsType.SIMPLE && pricingSettings.simple) {
        tariff = OCPIUtils.convertSimplePricingSettingToOcpiTariff(pricingSettings.simple);
        if (tariff.currency && tariff.elements[0].price_components[0].price > 0) {
          tariffs.push(tariff);
        } else if (tariff.currency && tariff.elements[0].price_components[0].price === 0) {
          tariff = this.convertPricingSettings2ZeroFlatTariff(pricingSettings);
          tariffs.push(tariff);
        }
      }
    }
    return {
      count: tariffs.length,
      result: tariffs
    };
  }

  private static convertPricingSettings2ZeroFlatTariff(pricingSettings: PricingSettings): OCPITariff {
    let tariff: OCPITariff;
    tariff.id = '1';
    tariff.elements = [
      {
        price_components: [
          {
            type: OCPITariffDimensionType.FLAT,
            price: 0,
            step_size: 0,
          }
        ]
      }
    ];
    switch (pricingSettings.type) {
      case PricingSettingsType.SIMPLE:
        tariff.currency = pricingSettings.simple.currency;
        tariff.last_updated = pricingSettings.simple.last_updated;
        break;
      default:
        tariff.currency = 'EUR';
        tariff.last_updated = new Date();
        break;
    }
    return tariff;
  }
}
