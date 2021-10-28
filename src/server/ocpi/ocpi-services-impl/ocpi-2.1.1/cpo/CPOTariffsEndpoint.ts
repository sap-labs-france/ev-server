import { NextFunction, Request, Response } from 'express';
import { OCPITariff, OCPITariffDimensionType } from '../../../../../types/ocpi/OCPITariff';
import { PricingSettings, PricingSettingsType } from '../../../../../types/Setting';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import Constants from '../../../../../utils/Constants';
import { DataResult } from '../../../../../types/DataResult';
import { HTTPError } from '../../../../../types/HTTPError';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import SettingStorage from '../../../../../storage/mongodb/SettingStorage';
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
    const tariffs = await this.getAllTariffs(tenant, limit, offset, Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    if (tariffs.count === 0) {
      throw new AppError({
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

  private async getAllTariffs(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPITariff>> {
    // Result
    const tariffs: OCPITariff[] = [];
    let tariff: OCPITariff;
    if (tenant.components?.pricing?.active) {
      // Get simple pricing settings
      const pricingSettings = await SettingStorage.getPricingSettings(tenant, limit, skip, dateFrom, dateTo);
      if (pricingSettings.type === PricingSettingsType.SIMPLE && pricingSettings.simple) {
        tariff = OCPIUtilsService.convertSimplePricingSetting2OCPITariff(pricingSettings.simple);
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

  private convertPricingSettings2ZeroFlatTariff(pricingSettings: PricingSettings): OCPITariff {
    let tariff: OCPITariff;
    tariff.id = '1';
    tariff.elements[0].price_components[0].price = 0;
    tariff.elements[0].price_components[0].type = OCPITariffDimensionType.FLAT;
    tariff.elements[0].price_components[0].step_size = 0;
    switch (pricingSettings.type) {
      case PricingSettingsType.SIMPLE:
        tariff.currency = pricingSettings.simple.currency;
        tariff.last_updated = pricingSettings.simple.last_updated;
        break;
      default:
        // FIXME: get currency from the TZ
        tariff.currency = 'EUR';
        tariff.last_updated = new Date();
        break;
    }
    return tariff;
  }
}
