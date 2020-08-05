import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOCPIService from '../../AbstractOCPIService';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import OCPIMapping from './OCPIMapping';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import OCPIUtils from '../../OCPIUtils';
import Tenant from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';

const EP_IDENTIFIER = 'cdrs';
const MODULE_NAME = 'CPOCdrsEndpoint';
const RECORDS_LIMIT = 25;

/**
 * CPO Sessions Endpoint
 */
export default class CPOCdrsEndpoint extends AbstractEndpoint {
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
        return await this.getCdrsRequest(req, res, next, tenant);
    }
  }

  /**
   * Get Cdrs according to the requested url Segment
   */
  async getCdrsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    // Split URL Segments
    //    /ocpi/cpo/2.0/sessions/?date_from=xxx&date_to=yyy
    // date_from optional
    // date_to optional
    // offset optional
    // limit optional
    // Get query parameters
    const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
    const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : RECORDS_LIMIT;
    // Get all cdrs
    const cdrs = await OCPIMapping.getAllCdrs(tenant, limit, offset, Utils.convertToDate(req.query.date_from), Utils.convertToDate(req.query.date_to));
    // Set header
    res.set({
      'X-Total-Count': cdrs.count,
      'X-Limit': RECORDS_LIMIT
    });
    // Return next link
    const nextUrl = OCPIUtils.buildNextUrl(req, this.getBaseUrl(req), offset, limit, cdrs.count);
    if (nextUrl) {
      res.links({
        next: nextUrl
      });
    }
    return OCPIUtils.success(cdrs.result);
  }
}
