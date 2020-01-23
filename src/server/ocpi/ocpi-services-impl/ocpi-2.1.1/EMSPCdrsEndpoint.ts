import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import OCPIUtils from '../../OCPIUtils';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPICdr } from '../../../../types/ocpi/OCPICdr';
import Transaction from '../../../../types/Transaction';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import { OCPILocation } from '../../../../types/ocpi/OCPILocation';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';

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
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getCdrRequest(req, res, next, tenant);
        break;
      case 'POST':
        return await this.postCdrRequest(req, res, next, tenant);
        break;
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
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'getSessionRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, id);

    if (!transaction || !transaction.ocpiCdr) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'postCdrRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: `The CDR ${id} does not exist or does not belong to the requester`,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
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

    if (!this.validateCdr(cdr)) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'postCdrRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Cdr object is invalid',
        detailedMessages: cdr,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenant.id, cdr.id);

    if (!transaction) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'postCdrRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: `No transaction found for ocpi session ${cdr.id}`,
        detailedMessages: cdr,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (transaction.ocpiCdr) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'postCdrRequest',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: `A cdr already exists for the session ${cdr.id}`,
        detailedMessages: cdr,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }

    transaction.ocpiCdr = cdr;
    await TransactionStorage.saveTransaction(tenant.id, transaction);

    res.setHeader('Location', OCPIUtils.buildLocationUrl(req, this.getBaseUrl(req), cdr.id));

    return OCPIUtils.success({});
  }

  private validateCdr(cdr: OCPICdr): boolean {
    if (!cdr.id
      || !cdr.start_date_time
      || !cdr.stop_date_time
      || !cdr.auth_id
      || !cdr.auth_method
      || !cdr.location
      || !cdr.currency
      || !cdr.charging_periods
      || !cdr.total_cost
      || !cdr.total_energy
      || !cdr.total_time
      || !cdr.last_updated
    ) {
      return false;
    }
    return this.validateLocation(cdr.location);
  }

  private validateLocation(location: OCPILocation): boolean {
    if (!location.evses || location.evses.length !== 1 || !location.evses[0].evse_id) {
      return false;
    }
    return true;
  }
}
