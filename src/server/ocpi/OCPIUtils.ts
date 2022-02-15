import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OCPIToken, OCPITokenType } from '../../types/ocpi/OCPIToken';

import AppError from '../../exception/AppError';
import BackendError from '../../exception/BackendError';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Company from '../../types/Company';
import CompanyStorage from '../../storage/mongodb/CompanyStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPIEndpoint from '../../types/ocpi/OCPIEndpoint';
import { OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import { OCPILocation } from '../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import OCPIUtilsService from './ocpi-services-impl/ocpi-2.1.1/OCPIUtilsService';
import { Request } from 'express';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteArea from '../../types/SiteArea';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'OCPIUtils';

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

  public static async checkAndGetEMSPCompany(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<Company> {
    let company = await CompanyStorage.getCompany(tenant, ocpiEndpoint.id);
    if (!company) {
      company = {
        id: ocpiEndpoint.id,
        name: `${ocpiEndpoint.name} (${ocpiEndpoint.role})`,
        issuer: false,
        createdOn: new Date()
      } as Company;
      await CompanyStorage.saveCompany(tenant, company, false);
    }
    return company;
  }

  public static async processEMSPLocation(tenant: Tenant, location: OCPILocation, company: Company, existingSites: Site[],
      countryCode?: string, partyID?: string): Promise<void> {
    // Handle Site
    let site: Site;
    const siteName = location.operator?.name ?? OCPIUtils.buildOperatorName(countryCode, partyID);
    site = existingSites.find((existingSite) => existingSite.name === siteName);
    if (!site) {
      // Create Site
      site = {
        name: siteName,
        createdOn: new Date(),
        companyID: company.id,
        issuer: false,
        address: {
          address1: location.address,
          postalCode: location.postal_code,
          city: location.city,
          country: location.country,
          coordinates: []
        }
      } as Site;
      if (location.coordinates?.latitude && location.coordinates?.longitude) {
        site.address.coordinates = [
          Utils.convertToFloat(location.coordinates.longitude),
          Utils.convertToFloat(location.coordinates.latitude)
        ];
      }
      site.id = await SiteStorage.saveSite(tenant, site, false);
      // Push the Site then it can be retrieve in the next round
      existingSites.push(site);
    }
    const locationName = site.name + Constants.OCPI_SEPARATOR + location.id;
    // Handle Site Area
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant,
      { siteIDs: [site.id], name: locationName, issuer: false, withSite: true },
      Constants.DB_PARAMS_SINGLE_RECORD);
    let siteArea = !Utils.isEmptyArray(siteAreas.result) ? siteAreas.result[0] : null;
    if (!siteArea) {
      // Create Site Area
      siteArea = {
        name: locationName,
        createdOn: new Date(),
        siteID: site.id,
        issuer: false,
        address: {
          address1: location.address,
          address2: location.name,
          postalCode: location.postal_code,
          city: location.city,
          country: location.country,
          coordinates: []
        }
      } as SiteArea;
      if (location.coordinates?.latitude && location.coordinates?.longitude) {
        siteArea.address.coordinates = [
          Utils.convertToFloat(location.coordinates.longitude),
          Utils.convertToFloat(location.coordinates.latitude)
        ];
      }
      siteArea.id = await SiteAreaStorage.saveSiteArea(tenant, siteArea, false);
    }
    if (!Utils.isEmptyArray(location.evses)) {
      for (const evse of location.evses) {
        if (!evse.uid) {
          throw new BackendError({
            action: ServerAction.OCPI_PULL_LOCATIONS,
            message: `Missing Charging Station EVSE UID in Location '${location.name}' with ID '${location.id}'`,
            module: MODULE_NAME, method: 'processLocation',
            detailedMessages:  { evse, location }
          });
        }
        if (evse.status === OCPIEvseStatus.REMOVED) {
          // Get existing charging station
          const currentChargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationUid(
            tenant, location.id, evse.uid, ['id']
          );
          if (currentChargingStation) {
            await ChargingStationStorage.deleteChargingStation(tenant, currentChargingStation.id);
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.OCPI_PULL_LOCATIONS,
              message: `Removed Charging Station EVSE UID '${evse.uid}' in Location '${location.name}' with ID '${location.id}'`,
              module: MODULE_NAME, method: 'processLocation',
              detailedMessages: { evse, location }
            });
          }
          continue;
        }
        // Update Charging Station
        const chargingStation = OCPIUtilsService.convertEvseToChargingStation(evse, location);
        chargingStation.companyID = siteArea.site?.companyID;
        chargingStation.siteID = siteArea.siteID;
        chargingStation.siteAreaID = siteArea.id;
        await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
        await ChargingStationStorage.saveChargingStationOcpiData(tenant, chargingStation.id, chargingStation.ocpiData);
        await Logging.logDebug({
          tenantID: tenant.id,
          action: ServerAction.OCPI_PULL_LOCATIONS,
          message: `Updated Charging Station ID '${evse.evse_id}' in Location '${location.name}'`,
          module: MODULE_NAME, method: 'processLocation',
          detailedMessages: location
        });
      }
    }
  }
}
