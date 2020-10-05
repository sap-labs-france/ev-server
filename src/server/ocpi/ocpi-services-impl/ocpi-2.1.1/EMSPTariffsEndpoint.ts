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
import { OCPITariff } from '../../../../types/ocpi/OCPITariff';
import OCPIUtils from '../../OCPIUtils';
import { PricingSettingsType } from '../../../../types/Setting';
import { ServerAction } from '../../../../types/Server';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../types/Tenant';

const EP_IDENTIFIER = 'tariffs';
const MODULE_NAME = 'EMSPTariffsEndpoint';

const RECORDS_LIMIT = 25;

/**
 * EMSP Tariffs Endpoint
 */
export default class EMSPTariffsEndpoint extends AbstractEndpoint {
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
        return await this.getTariffRequest(req, res, next, tenant);
    }
  }

  /**
   * Get the Tariff object from the eMSP system by its id {tariff_id}.
   *
   * /tariffs/{country_code}/{party_id}/{tariff_id}
   *
   */
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
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'getTariffRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    let tariff: OCPITariff = {} as OCPITariff;
    if (tenant.components?.pricing?.active) {
      // Get simple pricing settings
      const pricingSettings = await SettingStorage.getPricingSettings(tenant.id);
      if (pricingSettings.type === PricingSettingsType.SIMPLE && pricingSettings.simple) {
        tariff = OCPIMapping.convertSimplePricingSetting2OCPITariff(pricingSettings.simple);
      } else {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getTariffRequest',
          action: ServerAction.OCPI_GET_TARIFF,
          errorCode: StatusCodes.BAD_REQUEST,
          message: `Simple Pricing setting not found on tenant ${tenant.name}`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    }
    return OCPIUtils.success(tariff);
  }
}

