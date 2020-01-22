import { Request } from 'express';
import Constants from '../../utils/Constants';
import AppError from '../../exception/AppError';
import { OCPIResponse } from '../../types/ocpi/OCPIResponse';

/**
 * OCPI Utils
 */
export default class OCPIUtils {

  /**
   * Return OCPI Success Body Response
   * @param {*} data
   */
  public static success(data?: any): OCPIResponse {
    return {
      'data': data,
      'status_code': Constants.OCPI_STATUS_CODE.CODE_1000_SUCCESS.status_code,
      'status_message': Constants.OCPI_STATUS_CODE.CODE_1000_SUCCESS.status_message,
      'timestamp': new Date().toISOString()
    };
  }

  /**
   * Return OCPI Error Body Response
   * @param {*} error
   */
  public static toErrorResponse(error: Error): OCPIResponse {
    return {
      'status_message': error.message,
      'timestamp': new Date().toISOString(),
      'status_code': error instanceof AppError && error.params.ocpiError ?
        error.params.ocpiError.status_code : Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR.status_code
    };
  }

  /**
   * Build Next Url
   * @param {*} req request in order to get url
   * @param {*} offset  offset
   * @param {*} limit limit of query
   * @param {*} total total number of records
   */
  public static buildNextUrl(req: Request, offset: number, limit: number, total: number): string | undefined {
    // Check if next link should be generated
    if (offset + limit < total) {
      // Build url
      return req.protocol + '://' + req.get('host') + req.originalUrl.split('?')[0] + '?offset=' + (offset + limit) + '&limit=' + limit;
    }
  }

  /**
   * Build Location Url
   * @param {*} req request in order to get url
   * @param {*} id the object id to build the location url
   */
  public static buildLocationUrl(req: Request, id: string): string {
    // Build url
    return req.protocol + '://' + req.get('host') + req.originalUrl.split('?')[0] + '/' + id;
  }

  /**
   * Convert from base64 back to String.
   * @param {*} string encoded base64
   */
  public static atob(base64: string): string {
    return Buffer.from(base64, 'base64').toString('binary');
  }

  /**
   * Convert to base64 from String.
   * @param {*} string encoded base64
   */
  public static btoa(string: string): string {
    return Buffer.from(string).toString('base64');
  }

  /**
   * Generate a local token for a tenant subdomain
   * @param tenantSubdomain
   */
  public static generateLocalToken(tenantSubdomain: string) {
    const newToken: any = {};
    // Generate random
    newToken.ak = Math.floor(Math.random() * 100);
    // Fill new Token with tenant subdmain
    newToken.tid = tenantSubdomain;
    // Generate random
    newToken.zk = Math.floor(Math.random() * 100);
    // Return in Base64
    return OCPIUtils.btoa(JSON.stringify(newToken));
  }

}
