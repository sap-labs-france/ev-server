import ChargingStation, { Connector } from '../../types/ChargingStation';

import AppError from '../../exception/AppError';
import { OCPIResponse } from '../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import { OCPIToken } from '../../types/ocpi/OCPIToken';
import { Request } from 'express';
import moment from 'moment';

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
      data: data,
      status_code: OCPIStatusCode.CODE_1000_SUCCESS.status_code,
      status_message: OCPIStatusCode.CODE_1000_SUCCESS.status_message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Return OCPI Error Body Response
   * @param {*} error
   */
  public static toErrorResponse(error: Error): OCPIResponse {
    return {
      status_message: error.message,
      timestamp: new Date().toISOString(),
      status_code: error instanceof AppError && error.params.ocpiError ?
        error.params.ocpiError.status_code : OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR.status_code
    };
  }

  /**
   * Build Next Url
   * @param {*} req request in order to get url
   * @param {*} baseUrl the baseUrl of the service to get url
   * @param {*} offset  offset
   * @param {*} limit limit of query
   * @param {*} total total number of records
   */
  public static buildNextUrl(req: Request, baseUrl: string, offset: number, limit: number, total: number): string | undefined {
    // Check if next link should be generated
    if (offset + limit < total) {
      // Build url
      const query = req.query;
      query.offset = (offset + limit).toString();
      query.limit = limit.toString();
      let queryString: string;
      for (const param in query) {
        queryString = queryString ? `${queryString}&${param}=${query[param]}` : `${param}=${query[param]}`;
      }
      return `${baseUrl + req.originalUrl.split('?')[0]}?${queryString}`;
    }
  }

  /**
   * Retrieve the next url from the link response header
   * @param {*} link the link header of the response
   */
  public static getNextUrl(link: string): string | undefined {
    if (link) {
      const match = /<(.*)>;rel="next"/.exec(link.replace(/ /g, ''));
      if (match) {
        return match[1];
      }
    }
  }

  /**
   * Build Location Url
   * @param {*} req request in order to get url
   * @param {*} baseUrl the baseUrl of the service to get url
   * @param {*} id the object id to build the location url
   */
  public static buildLocationUrl(req: Request, baseUrl: string, id: string): string {
    // Build url
    return `${baseUrl + req.originalUrl.split('?')[0]}/${id}`;
  }

  /**
   * Build Charging Station Id from OCPI location
   * @param {*} locationId id of the location
   * @param {*} evseId id of the evse
   */
  public static buildChargingStationId(locationId: string, evseId: string): string {
    return `${locationId}-${evseId}`;
  }

  /**
   * Build Operator name from OCPI identifiers (country code and party Id)
   * @param {*} countryCode the code of the operator
   * @param {*} partyId the partyId of the operator
   */
  public static buildOperatorName(countryCode: string, partyId: string): string {
    return `${countryCode}*${partyId}`;
  }

  /**
   * Build Site Area name from OCPI location
   * @param {*} countryCode the code of the CPO
   * @param {*} partyId the partyId of the CPO
   * @param {*} locationId id of the location
   */
  public static buildSiteAreaName(countryCode: string, partyId: string, locationId: string): string {
    return `${countryCode}*${partyId}-${locationId}`;
  }

  /**
   * Build evse_id from charging station
   * @param {*} countryCode the code of the CPO
   * @param {*} partyId the partyId of the CPO
   * @param {*} chargingStation the charging station used to build the evse ID
   * @param {*} connector the connector used to build the evse id
   */
  public static buildEvseID(countryCode: string, partyId: string, chargingStation: ChargingStation, connector?: Connector): string {
    let evseID = `${countryCode}*${partyId}*E${chargingStation.id}`;
    if (!connector) {
      for (const _connector of chargingStation.connectors) {
        if (_connector) {
          connector = _connector;
          break;
        }
      }
    }
    evseID = `${evseID}*${connector.connectorId}`;
    return evseID.replace(/[\W_]+/g, '*').toUpperCase();
  }

  /**
   * Build evse UID from charging station
   * @param {*} chargingStation the charging station used to build the evse ID
   * @param {*} connector the connector used to build the evse id
   */
  public static buildEvseUID(chargingStation: ChargingStation, connector?: Connector): string {
    if (!connector) {
      for (const _connector of chargingStation.connectors) {
        if (_connector) {
          connector = _connector;
          break;
        }
      }
    }
    return `${chargingStation.id}*${connector.connectorId}`;
  }

  /**
   * Build evse UIDs from charging station
   * @param {*} chargingStation the charging station used to build the evse ID
   * @param {*} connector the connector used to build the evse id
   */
  public static buildEvseUIDs(chargingStation: ChargingStation, connector?: Connector): string[] {
    const evseUIDs = [];
    if (connector) {
      evseUIDs.push(`${chargingStation.id}*${connector.connectorId}`);
    } else if (chargingStation.connectors) {
      for (const _connector of chargingStation.connectors) {
        if (_connector) {
          evseUIDs.push(`${chargingStation.id}*${_connector.connectorId}`);
        }
      }
    }
    return evseUIDs;
  }

  /**
   * Build User email from OCPI token, eMSP country code and eMSP partyId
   * @param {*} token the OCPI token of the user
   * @param {*} countryCode the country code of the eMSP
   * @param {*} partyId the party identifier of the eMSP
   */
  public static buildEmspEmailFromOCPIToken(token: OCPIToken, countryCode: string, partyId: string): string {
    if (token && token.issuer) {
      return `${token.issuer}@${partyId}.${countryCode}`;
    }
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
  public static generateLocalToken(tenantSubdomain: string): string {
    const newToken: any = {};
    // Generate random
    newToken.ak = Math.floor(Math.random() * 100);
    // Fill new Token with tenant subdomain
    newToken.tid = tenantSubdomain;
    // Generate random
    newToken.zk = Math.floor(Math.random() * 100);
    // Return in Base64
    return OCPIUtils.btoa(JSON.stringify(newToken));
  }

  public static isAuthorizationValid(authorizationDate: Date): boolean {
    return authorizationDate && moment(authorizationDate).isAfter(moment().subtract(2, 'minutes'));
  }
}
