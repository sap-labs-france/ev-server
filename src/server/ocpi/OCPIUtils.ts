import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OCPIToken, OCPITokenType } from '../../types/ocpi/OCPIToken';

import AppError from '../../exception/AppError';
import Constants from '../../utils/Constants';
import { OCPIResponse } from '../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import { Request } from 'express';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default class OCPIUtils {

  public static getConnectorIDFromEvseID(evseID: string): string {
    return evseID.split(Constants.OCPI_SEPARATOR).pop();
  }

  public static getConnectorIDFromEvseUID(evseUID: string): string {
    return evseUID.split(Constants.OCPI_SEPARATOR).pop();
  }

  public static success(data?: any): OCPIResponse {
    return {
      data: data,
      status_code: OCPIStatusCode.CODE_1000_SUCCESS.status_code,
      status_message: OCPIStatusCode.CODE_1000_SUCCESS.status_message,
      timestamp: new Date().toISOString()
    };
  }

  public static toErrorResponse(error: Error): OCPIResponse {
    return {
      status_message: error.message,
      timestamp: new Date().toISOString(),
      status_code: error instanceof AppError && error.params.ocpiError ?
        error.params.ocpiError.status_code : OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR.status_code
    };
  }

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

  public static getNextUrl(link: string): string | undefined {
    if (link) {
      const match = /<(.*)>;rel="next"/.exec(link.replace(/ /g, ''));
      if (match) {
        return match[1];
      }
    }
  }

  public static buildLocationUrl(req: Request, baseUrl: string, id: string): string {
    // Build url
    return `${baseUrl + req.originalUrl.split('?')[0]}/${id}`;
  }

  public static buildChargingStationId(locationId: string, evseId: string): string {
    return `${locationId}-${evseId}`;
  }

  public static buildOperatorName(countryCode: string, partyId: string): string {
    return `${countryCode}*${partyId}`;
  }

  public static buildSiteAreaName(countryCode: string, partyId: string, locationId: string): string {
    return `${countryCode}*${partyId}-${locationId}`;
  }

  public static buildEvseUID(chargingStation: ChargingStation, connector: Connector): string {
    // connectors are grouped in the same evse when the connectors cannot charge in parallel
    if (connector.chargePointID) {
      const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
      if (chargePoint && chargePoint.cannotChargeInParallel) {
        return `${chargingStation.id}*${chargePoint.chargePointID}`;
      }
    }
    return `${chargingStation.id}*${connector.connectorId}`;
  }

  public static buildEvseUIDs(chargingStation: ChargingStation): string[] {
    const evseUIDs: string[] = [];
    for (const _connector of chargingStation.connectors) {
      if (_connector) {
        evseUIDs.push(OCPIUtils.buildEvseUID(chargingStation, _connector));
      }
    }
    return evseUIDs;
  }

  public static buildEmspEmailFromOCPIToken(token: OCPIToken, countryCode: string, partyId: string): string {
    if (token?.issuer) {
      return `${token.issuer}@${partyId}.${countryCode}`.toLowerCase();
    }
  }

  public static atob(base64: string): string {
    return Buffer.from(base64, 'base64').toString('binary');
  }

  public static btoa(str: string): string {
    return Buffer.from(str).toString('base64');
  }

  public static getOCPITokenTypeFromID(tagID: string): OCPITokenType {
    // Virtual badges handling
    return tagID.length % 8 === 0 ? OCPITokenType.RFID : OCPITokenType.OTHER;
  }

  public static getOCPIEmspLocationIDFromSiteAreaName(siteAreaName: string): string {
    const siteParts = siteAreaName.split(Constants.OCPI_SEPARATOR);
    return siteParts.pop();
  }

  public static generateLocalToken(tenantSubdomain: string): string {
    const newToken: any = {};
    // Generate random
    newToken.ak = Utils.getRandomInt(100);
    // Fill new Token with tenant subdomain
    newToken.tid = tenantSubdomain;
    // Generate random
    newToken.zk = Utils.getRandomInt(100);
    // Return in Base64
    return OCPIUtils.btoa(JSON.stringify(newToken));
  }

  public static isAuthorizationValid(authorizationDate: Date): boolean {
    return authorizationDate && moment(authorizationDate).isAfter(moment().subtract(
      Constants.ROAMING_AUTHORIZATION_TIMEOUT_MINS, 'minutes'));
  }
}
