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
import UserStorage from '../../../../storage/mongodb/UserStorage';
import uuid = require('uuid');
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';

const EP_IDENTIFIER = 'sessions';
const MODULE_NAME = 'EMSPSessionsEndpoint';

const RECORDS_LIMIT = 100;
/**
 * EMSP Tokens Endpoint
 */
export default class EMSPSessionsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    switch (req.method) {
      case 'GET':
        await this.getSessionRequest(req, res, next, tenant);
        break;
      case 'PATCH':
        await this.patchSessionRequest(req, res, next, tenant);
        break;
      case 'PUT':
        await this.putSessionRequest(req, res, next, tenant);
        break;
      default:
        res.sendStatus(501);
        break;
    }
  }

  /**
   * Get the Session object from the eMSP system by its id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   *
   */
  private async getSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();

    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    res.json(OCPIUtils.success());
  }

  /**
   * Send a new/updated Session object.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
  private async putSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();

    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    res.json(OCPIUtils.success(
      {}));
  }

  /**
   * Update the Session object of id {session_id}.
   *
   * /sessions/{country_code}/{party_id}/{session_id}
   */
  private async patchSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();

    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const sessionId = urlSegment.shift();

    if (!countryCode || !partyId || !sessionId) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    res.json(OCPIUtils.success(
      {}));
  }
}

