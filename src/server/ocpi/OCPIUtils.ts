import ChargingStation, { Connector, ConnectorType, CurrentType } from '../../types/ChargingStation';
import { OCPIConnector, OCPIConnectorType, OCPIPowerType } from '../../types/ocpi/OCPIConnector';
import OCPIEndpoint, { OCPIAvailableEndpoints, OCPIEndpointVersions } from '../../types/ocpi/OCPIEndpoint';
import { OCPIEvse, OCPIEvseStatus } from '../../types/ocpi/OCPIEvse';
import { OCPITariff, OCPITariffDimensionType } from '../../types/ocpi/OCPITariff';
import { OCPIToken, OCPITokenType, OCPITokenWhitelist } from '../../types/ocpi/OCPIToken';
import User, { UserRole, UserStatus } from '../../types/User';

import AppError from '../../exception/AppError';
import BackendError from '../../exception/BackendError';
import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Company from '../../types/Company';
import CompanyStorage from '../../storage/mongodb/CompanyStorage';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import OCPICredential from '../../types/ocpi/OCPICredential';
import { OCPILocation } from '../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../types/ocpi/OCPIResponse';
import { OCPIRole } from '../../types/ocpi/OCPIRole';
import { OCPISessionStatus } from '../../types/ocpi/OCPISession';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import { Request } from 'express';
import RoamingUtils from '../../utils/RoamingUtils';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { SimplePricingSetting } from '../../types/Setting';
import Site from '../../types/Site';
import SiteArea from '../../types/SiteArea';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tag from '../../types/Tag';
import Tenant from '../../types/Tenant';
import UserStorage from '../../storage/mongodb/UserStorage';
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

  public static async buildOcpiCredentialObject(tenant: Tenant, token: string, role: string, versionUrl?: string): Promise<OCPICredential> {
    // Credential
    const credential = {} as OCPICredential;
    // Get ocpi service configuration
    const ocpiSetting = await SettingStorage.getOCPISettings(tenant);
    // Define version url
    credential.url = versionUrl ?? `${Configuration.getOCPIEndpointConfig().baseUrl}/ocpi/${role.toLowerCase()}/versions`;
    // Check if available
    if (ocpiSetting?.ocpi) {
      credential.token = token;
      if (role === OCPIRole.EMSP) {
        credential.country_code = ocpiSetting.ocpi.emsp.countryCode;
        credential.party_id = ocpiSetting.ocpi.emsp.partyID;
      } else {
        credential.country_code = ocpiSetting.ocpi.cpo.countryCode;
        credential.party_id = ocpiSetting.ocpi.cpo.partyID;
      }
      credential.business_details = ocpiSetting.ocpi.businessDetails;
    }
    return credential;
  }

  public static convertAvailableEndpoints(endpointURLs: OCPIEndpointVersions): OCPIAvailableEndpoints {
    const availableEndpoints = {} as OCPIAvailableEndpoints;
    if (!Utils.isEmptyArray(endpointURLs.endpoints)) {
      for (const endpoint of endpointURLs.endpoints) {
        availableEndpoints[endpoint.identifier] = endpoint.url;
      }
    }
    return availableEndpoints;
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
        queryString = queryString ? `${queryString}&${param}=${query[param] as string}` : `${param}=${query[param] as string}`;
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
    return `${baseUrl + req.originalUrl.split('?')[0]}/${id}`;
  }

  public static buildChargingStationId(locationId: string, evseId: string): string {
    return `${locationId}-${evseId}`;
  }

  public static buildOperatorName(countryCode: string, partyId: string): string {
    return `${countryCode}*${partyId}`;
  }

  public static buildEvseUIDs(chargingStation: ChargingStation): string[] {
    const evseUIDs: string[] = [];
    for (const connector of chargingStation.connectors) {
      if (connector) {
        evseUIDs.push(RoamingUtils.buildEvseUID(chargingStation, connector.connectorId));
      }
    }
    return evseUIDs;
  }

  public static buildEmspEmailFromEmspToken(token: OCPIToken, countryCode: string, partyId: string): string {
    return `${token.issuer}@${partyId}.${countryCode}`.toLowerCase();
  }

  public static async checkAndCreateEMSPUserFromToken(tenant: Tenant, countryCode: string, partyId: string, token: OCPIToken): Promise<User> {
    // Get eMSP user
    const email = OCPIUtils.buildEmspEmailFromEmspToken(token, countryCode, partyId);
    // Get User from DB
    let emspUser = await UserStorage.getUserByEmail(tenant, email);
    // Create user
    if (!emspUser) {
      // Create User
      emspUser = {
        issuer: false,
        createdOn: token.last_updated,
        lastChangedOn: token.last_updated,
        name: token.issuer,
        firstName: OCPIUtils.buildOperatorName(countryCode, partyId),
        email,
        locale: Utils.getLocaleFromLanguage(token.language),
      } as User;
      // Save User
      emspUser.id = await UserStorage.saveUser(tenant, emspUser);
      await UserStorage.saveUserRole(tenant, emspUser.id, UserRole.BASIC);
      await UserStorage.saveUserStatus(tenant, emspUser.id, UserStatus.ACTIVE);
    }
    return emspUser;
  }

  public static atob(base64: string): string {
    return Buffer.from(base64, 'base64').toString('binary');
  }

  public static btoa(str: string): string {
    return Buffer.from(str).toString('base64');
  }

  public static getOcpiTokenTypeFromID(tagID: string): OCPITokenType {
    // Virtual badges handling
    return (tagID.length % 8 === 0 || tagID.length === 14) &&
      Utils.isHexString(tagID) ? OCPITokenType.RFID : OCPITokenType.OTHER;
  }

  public static buildEmspTokenFromTag(tenant: Tenant, tag: Tag): OCPIToken {
    return {
      uid: tag.id,
      type: OCPIUtils.getOcpiTokenTypeFromID(tag.id),
      auth_id: tag.id,
      visual_number: tag.visualID,
      issuer: tenant.name,
      valid: tag.active && tag.user?.status === UserStatus.ACTIVE,
      whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
      last_updated: tag.lastChangedOn ?? tag.createdOn ?? new Date()
    };
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

  public static async checkAndGetEmspCompany(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<Company> {
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

  public static async updateCreateChargingStationsWithEmspLocation(tenant: Tenant, location: OCPILocation, site: Site,
      siteArea: SiteArea, evses: OCPIEvse[], action: ServerAction): Promise<void> {
    // Process Charging Stations
    if (!Utils.isEmptyArray(evses)) {
      for (const evse of evses) {
        try {
          await OCPIUtils.updateCreateChargingStationWithEmspLocation(tenant, location, site, siteArea, evse, action);
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id,
            action, module: MODULE_NAME, method: 'processEMSPLocationChargingStations',
            message: `Error while processing the EVSE UID '${evse.uid}' (ID '${evse.evse_id}') in Location '${location.name}'`,
            detailedMessages: { error: error.stack, evse, location, site, siteArea }
          });
        }
      }
    }
  }

  public static async updateCreateChargingStationWithEmspLocation(tenant: Tenant, location: OCPILocation, site: Site,
      siteArea: SiteArea, evse: OCPIEvse, action: ServerAction): Promise<void> {
    if (!evse.uid) {
      throw new BackendError({
        action, module: MODULE_NAME, method: 'processEMSPLocationChargingStation',
        message: `Missing Charging Station EVSE UID in Location '${location.name}' with ID '${location.id}'`,
        detailedMessages:  { evse, location }
      });
    }
    // Get existing charging station
    const currentChargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationEvseUid(
      tenant, location.id, evse.uid, false, false);
    // Delete Charging Station
    if (currentChargingStation && evse.status === OCPIEvseStatus.REMOVED) {
      await ChargingStationStorage.deleteChargingStation(tenant, currentChargingStation.id);
      await Logging.logDebug({
        ...LoggingHelper.getChargingStationProperties(currentChargingStation),
        tenantID: tenant.id,
        action, module: MODULE_NAME, method: 'processEMSPLocationChargingStation',
        message: `Deleted Charging Station ID '${currentChargingStation.id}' in Location '${location.name}' with ID '${location.id}'`,
        detailedMessages: { evse, location }
      });
    // Update/Create Charging Station
    } else {
      const chargingStation = OCPIUtils.convertEvseToChargingStation(
        currentChargingStation, evse, location, site, siteArea, action);
      await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
      await ChargingStationStorage.saveChargingStationOcpiData(tenant, chargingStation.id, chargingStation.ocpiData);
      await Logging.logDebug({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action, module: MODULE_NAME, method: 'processEMSPLocationChargingStation',
        message: `${currentChargingStation ? 'Updated' : 'Created'} Charging Station ID '${chargingStation.id}' in Location '${location.name}' with ID '${location.id}'`,
        detailedMessages: { evse, location }
      });
    }
  }

  public static convertEvseToChargingStation(chargingStation: ChargingStation, evse: OCPIEvse,
      location: OCPILocation, site: Site, siteArea: SiteArea, action: ServerAction): ChargingStation {
    if (!evse.evse_id) {
      throw new BackendError({
        action, module: MODULE_NAME, method: 'convertEvseToChargingStation',
        message: 'Cannot find Charging Station EVSE ID',
        detailedMessages:  { evse, location }
      });
    }
    if (!chargingStation) {
      chargingStation = {
        id: evse.evse_id,
        createdOn: new Date(),
        maximumPower: 0,
        issuer: false,
        connectors: [],
        public: true,
        companyID: site.companyID,
        siteID: site.id,
        siteAreaID: siteArea.id,
        ocpiData: {
          evses: [evse]
        }
      } as ChargingStation;
    } else {
      chargingStation = {
        ...chargingStation,
        maximumPower: 0,
        public: true,
        lastChangedOn: new Date(),
        connectors: [],
        ocpiData: {
          evses: [evse]
        }
      } as ChargingStation;
    }
    // Set the location ID
    evse.location_id = location.id;
    // Coordinates
    if (evse.coordinates?.latitude && evse.coordinates?.longitude) {
      chargingStation.coordinates = [
        Utils.convertToFloat(evse.coordinates.longitude),
        Utils.convertToFloat(evse.coordinates.latitude)
      ];
    } else if (location?.coordinates?.latitude && location?.coordinates?.longitude) {
      chargingStation.coordinates = [
        Utils.convertToFloat(location.coordinates.longitude),
        Utils.convertToFloat(location.coordinates.latitude)
      ];
    }
    if (!Utils.isEmptyArray(evse.connectors)) {
      let connectorID = 1;
      for (const evseConnector of evse.connectors) {
        const connector = OCPIUtils.convertEvseToChargingStationConnector(evse, evseConnector, connectorID++);
        chargingStation.connectors.push(connector);
        chargingStation.maximumPower = Math.max(chargingStation.maximumPower, connector.power);
      }
    }
    return chargingStation;
  }

  public static convertEvseToChargingStationConnector(evse: OCPIEvse, evseConnector: OCPIConnector, connectorID: number): Connector {
    return {
      id: evseConnector.id,
      status: OCPIUtils.convertOcpiStatusToStatus(evse.status),
      amperage: evseConnector.amperage,
      voltage: evseConnector.voltage,
      currentType: evseConnector.power_type === OCPIPowerType.DC ? CurrentType.DC : CurrentType.AC,
      connectorId: connectorID,
      currentInstantWatts: 0,
      tariffID: evseConnector.tariff_id,
      power: evseConnector.amperage * evseConnector.voltage,
      type: OCPIUtils.convertOcpiConnectorTypeToConnectorType(evseConnector.standard),
    };
  }

  public static convertOcpiConnectorTypeToConnectorType(ocpiConnectorType: OCPIConnectorType): ConnectorType {
    switch (ocpiConnectorType) {
      case OCPIConnectorType.CHADEMO:
        return ConnectorType.CHADEMO;
      case OCPIConnectorType.IEC_62196_T2:
        return ConnectorType.TYPE_2;
      case OCPIConnectorType.IEC_62196_T2_COMBO:
        return ConnectorType.COMBO_CCS;
      case OCPIConnectorType.IEC_62196_T3:
      case OCPIConnectorType.IEC_62196_T3A:
        return ConnectorType.TYPE_3C;
      case OCPIConnectorType.IEC_62196_T1:
        return ConnectorType.TYPE_1;
      case OCPIConnectorType.IEC_62196_T1_COMBO:
        return ConnectorType.TYPE_1_CCS;
      case OCPIConnectorType.DOMESTIC_A:
      case OCPIConnectorType.DOMESTIC_B:
      case OCPIConnectorType.DOMESTIC_C:
      case OCPIConnectorType.DOMESTIC_D:
      case OCPIConnectorType.DOMESTIC_E:
      case OCPIConnectorType.DOMESTIC_F:
      case OCPIConnectorType.DOMESTIC_G:
      case OCPIConnectorType.DOMESTIC_H:
      case OCPIConnectorType.DOMESTIC_I:
      case OCPIConnectorType.DOMESTIC_J:
      case OCPIConnectorType.DOMESTIC_K:
      case OCPIConnectorType.DOMESTIC_L:
        return ConnectorType.DOMESTIC;
      default:
        return ConnectorType.UNKNOWN;
    }
  }

  public static convertOcpiStatusToStatus(status: OCPIEvseStatus): ChargePointStatus {
    switch (status) {
      case OCPIEvseStatus.AVAILABLE:
        return ChargePointStatus.AVAILABLE;
      case OCPIEvseStatus.BLOCKED:
        return ChargePointStatus.OCCUPIED;
      case OCPIEvseStatus.CHARGING:
        return ChargePointStatus.CHARGING;
      case OCPIEvseStatus.INOPERATIVE:
      case OCPIEvseStatus.OUTOFORDER:
        return ChargePointStatus.FAULTED;
      case OCPIEvseStatus.PLANNED:
      case OCPIEvseStatus.RESERVED:
        return ChargePointStatus.RESERVED;
      default:
        return ChargePointStatus.UNAVAILABLE;
    }
  }

  public static convertOcpiSessionStatusToConnectorStatus(status: OCPISessionStatus): ChargePointStatus {
    switch (status) {
      case OCPISessionStatus.PENDING:
        return ChargePointStatus.PREPARING;
      case OCPISessionStatus.COMPLETED:
        return ChargePointStatus.AVAILABLE;
      case OCPISessionStatus.INVALID:
        return ChargePointStatus.FAULTED;
      case OCPISessionStatus.ACTIVE:
        return ChargePointStatus.CHARGING;
    }
  }

  public static convertStatusToOcpiStatus(status: ChargePointStatus): OCPIEvseStatus {
    switch (status) {
      case ChargePointStatus.PREPARING:
      case ChargePointStatus.AVAILABLE:
        return OCPIEvseStatus.AVAILABLE;
      case ChargePointStatus.UNAVAILABLE:
      case ChargePointStatus.OCCUPIED:
      case ChargePointStatus.SUSPENDED_EV:
      case ChargePointStatus.SUSPENDED_EVSE:
      case ChargePointStatus.FINISHING:
      case ChargePointStatus.CHARGING:
        return OCPIEvseStatus.CHARGING;
      case ChargePointStatus.FAULTED:
        return OCPIEvseStatus.INOPERATIVE;
      case ChargePointStatus.RESERVED:
        return OCPIEvseStatus.RESERVED;
      default:
        return OCPIEvseStatus.UNKNOWN;
    }
  }

  public static convertSimplePricingSettingToOcpiTariff(simplePricingSetting: SimplePricingSetting): OCPITariff {
    const tariff = {} as OCPITariff;
    tariff.id = '1';
    tariff.currency = simplePricingSetting.currency;
    tariff.elements = [
      {
        price_components: [
          {
            type: OCPITariffDimensionType.TIME,
            price: simplePricingSetting.price,
            step_size: 60,
          }
        ]
      }
    ];
    tariff.last_updated = simplePricingSetting.last_updated;
    return tariff;
  }

  public static async updateCreateSiteWithEmspLocation(tenant: Tenant, location: OCPILocation, company: Company, site: Site, siteName?: string): Promise<Site> {
    // Create Site
    if (!site) {
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
    } else {
      site = {
        ...site,
        lastChangedOn: new Date(),
        ocpiData: { location },
        address: {
          address1: location.address,
          postalCode: location.postal_code,
          city: location.city,
          country: location.country,
          coordinates: []
        }
      } as Site;
    }
    if (location.coordinates?.latitude && location.coordinates?.longitude) {
      site.address.coordinates = [
        Utils.convertToFloat(location.coordinates.longitude),
        Utils.convertToFloat(location.coordinates.latitude)
      ];
    }
    // Save Site
    site.id = await SiteStorage.saveSite(tenant, site);
    return site;
  }

  public static async updateCreateSiteAreaWithEmspLocation(tenant: Tenant, location: OCPILocation, site: Site, siteArea: SiteArea): Promise<SiteArea> {
    // Create Site Area
    if (!siteArea) {
      siteArea = {
        name: location.name,
        createdOn: new Date(),
        siteID: site.id,
        issuer: false,
        ocpiData: { location },
        address: {
          address1: location.address,
          postalCode: location.postal_code,
          city: location.city,
          country: location.country,
          coordinates: []
        }
      } as SiteArea;
    } else {
      siteArea = {
        ...siteArea,
        name: location.name,
        lastChangedOn: new Date(),
        siteID: site.id,
        ocpiData: { location },
        address: {
          address1: location.address,
          postalCode: location.postal_code,
          city: location.city,
          country: location.country,
          coordinates: []
        }
      } as SiteArea;
    }
    if (location.coordinates?.latitude && location.coordinates?.longitude) {
      siteArea.address.coordinates = [
        Utils.convertToFloat(location.coordinates.longitude),
        Utils.convertToFloat(location.coordinates.latitude)
      ];
    }
    // Save Site Area
    siteArea.id = await SiteAreaStorage.saveSiteArea(tenant, siteArea);
    await SiteAreaStorage.saveSiteAreaOcpiData(tenant, siteArea.id, siteArea.ocpiData);
    return siteArea;
  }
}
