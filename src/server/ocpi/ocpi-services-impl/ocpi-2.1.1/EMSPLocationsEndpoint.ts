import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';
import Site from '../../../../types/Site';

const EP_IDENTIFIER = 'locations';
const MODULE_NAME = 'EMSPLocationsEndpoint';

/**
 * EMSP Locations Endpoint
 */
export default class EMSPLocationsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    switch (req.method) {
      case 'PATCH':
        await this.patchLocationsRequest(req, res, next, tenant);
        break;
      case 'PUT':
        await this.putLocationsRequest(req, res, next, tenant);
        break;
      default:
        res.sendStatus(501);
        break;
    }
  }

  /**
   * Notify the eMSP of partial updates to a Location, EVSEs or Connector (such as the status).
   *
   * /locations/{country_code}/{party_id}/{location_id}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}/{connector_id}
   */
  private async patchLocationsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const locationId = urlSegment.shift();
    const evseUid = urlSegment.shift();
    const connectorId = urlSegment.shift();

    if (!countryCode || !partyId || !locationId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'patchLocationRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    res.json(OCPIUtils.success());
  }

  /**
   * Push new/updated Location, EVSE and/or Connectors to the eMSP.
   *
   * /locations/{country_code}/{party_id}/{location_id}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}/{connector_id}
   */
  private async putLocationsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const locationId = urlSegment.shift();
    const evseUid = urlSegment.shift();
    const connectorId = urlSegment.shift();

    if (!countryCode || !partyId || !locationId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'patchLocationRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    res.json(OCPIUtils.success());
  }
}

