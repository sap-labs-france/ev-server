import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOCPIService from '../../AbstractOCPIService';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import Utils from '../../../../utils/Utils';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';

const EP_IDENTIFIER = 'cdrs';
const MODULE_NAME = 'CPOSessionsEndpoint';

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
    const limit = (req.query.limit && req.query.limit < RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : RECORDS_LIMIT;
    // Get all sessions
    const cdrs = await OCPIMapping.getAllCdrs(tenant, limit, offset, req.query.date_from, req.query.date_to);
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
