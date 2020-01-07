import { OCPICapability, OCPIEvse, OCPIEvseStatus } from '../../../../types/ocpi/OCPIEvse';
import { OCPIConnector, OCPIConnectorFormat, OCPIConnectorType, OCPIPowerType } from '../../../../types/ocpi/OCPIConnector';
import { OCPILocation, OCPILocationType } from '../../../../types/ocpi/OCPILocation';
import ChargingStation, { Connector } from '../../../../types/ChargingStation';
import Constants from '../../../../utils/Constants';
import { DataResult } from '../../../../types/DataResult';
import { OCPIToken } from '../../../../types/ocpi/OCPIToken';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import Tenant from '../../../../types/Tenant';
import UserStorage from '../../../../storage/mongodb/UserStorage';

/**
 * OCPI Mapping 2.1.1 - Mapping class
 * Mainly contains helper functions to convert internal entity to OCPI 2.1.1 Entity
 */
export default class OCPIMapping {
  /**
   * Convert Site to OCPI Location
   * @param {Tenant} tenant
   * @param {Site} site
   * @param options
   * @return OCPI Location
   */
  static async convertSite2Location(tenant: Tenant, site: Site, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPILocation> {
    // Build object
    return {
      'id': site.id,
      'type': OCPILocationType.UNKNOWN,
      'name': site.name,
      'address': `${site.address.address1} ${site.address.address2}`,
      'city': site.address.city,
      'postal_code': site.address.postalCode,
      'country': site.address.country,
      'coordinates': {
        'latitude': site.address.coordinates[1].toString(),
        'longitude': site.address.coordinates[0].toString()
      },
      'evses': await OCPIMapping.getEvsesFromSite(tenant, site, options),
      'last_updated': site.lastChangedOn
    };
  }

  static convertEvseToChargingStation(evse: Partial<OCPIEvse>, location?: OCPILocation): Partial<ChargingStation> {
    const chargingStation: Partial<ChargingStation> = {
      id: evse.evse_id,
      maximumPower: 0,
      cannotChargeInParallel: true,
      issuer: false,
      connectors: []
    };

    if (evse.coordinates && evse.coordinates.latitude && evse.coordinates.longitude) {
      chargingStation.coordinates = [
        Number.parseFloat(evse.coordinates.longitude),
        Number.parseFloat(evse.coordinates.latitude)
      ];
    } else if (location && location.coordinates && location.coordinates.latitude && location.coordinates.longitude) {
      chargingStation.coordinates = [
        Number.parseFloat(location.coordinates.longitude),
        Number.parseFloat(location.coordinates.latitude)
      ];
    }

    if (evse.connectors && evse.connectors.length > 0) {
      let connectorId = 1;
      for (const ocpiConnector of evse.connectors) {
        const connector: Connector = {
          name: ocpiConnector.id,
          status: OCPIMapping.convertOCPIStatus2Status(evse.status),
          amperage: ocpiConnector.amperage,
          voltage: ocpiConnector.voltage,
          connectorId: connectorId,
          currentConsumption: 0,
          power: ocpiConnector.amperage * ocpiConnector.voltage,
          type: OCPIMapping.convertOCPIConnectorType2ConnectorType(ocpiConnector.standard),
        };
        chargingStation.maximumPower = Math.max(chargingStation.maximumPower, connector.power);
        chargingStation.connectors.push(connector);
        connectorId++;
      }
    }
    return chargingStation;
  }

  /**
   * Get Evses from SiteArea
   * @param {Tenant} tenant
   * @param {SiteArea} siteArea
   * @return Array of OCPI EVSES
   */
  static getEvsesFromSiteaArea(tenant: Tenant, siteArea: SiteArea, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OCPIEvse[] {
    // Build evses array
    const evses: any = [];
    // Convert charging stations to evse(s)
    siteArea.chargingStations.forEach((chargingStation) => {
      if (!chargingStation.cannotChargeInParallel) {
        evses.push(...OCPIMapping.convertChargingStation2MultipleEvses(tenant, chargingStation, options));
      } else {
        evses.push(...OCPIMapping.convertChargingStation2UniqueEvse(tenant, chargingStation, options));
      }
    });

    // Return evses
    return evses;
  }

  /**
   * Get Evses from Site
   * @param {Tenant} tenant
   * @param {Site} site
   * @param options
   * @return Array of OCPI EVSES
   */
  static async getEvsesFromSite(tenant: Tenant, site: Site, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIEvse[]> {
    // Build evses array
    const evses = [];
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id,
      {
        withChargeBoxes: true,
        siteIDs: [site.id]
      },
      Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      // Get charging stations from SiteArea
      evses.push(...OCPIMapping.getEvsesFromSiteaArea(tenant, siteArea, options));
    }

    // Return evses
    return evses;
  }

  /**
   * Get All OCPI Locations from given tenant
   * @param {Tenant} tenant
   */
  static async getAllLocations(tenant: Tenant, limit: number, skip: number, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    // Result
    const result: any = { count: 0, locations: [] };

    // Get all sites
    const sites = await SiteStorage.getSites(tenant.id, {}, { limit, skip });

    // Convert Sites to Locations
    for (const site of sites.result) {
      result.locations.push(await OCPIMapping.convertSite2Location(tenant, site, options));
    }

    // Set count
    result.count = sites.count;

    // Return locations
    return result;
  }

  /**
   * Get All OCPI Tokens from given tenant
   * @param {Tenant} tenant
   */
  static async getAllTokens(tenant: Tenant, limit: number, skip: number): Promise<DataResult<OCPIToken>> {
    // Result
    const tokens: OCPIToken[] = [];

    // Get all tokens
    const tags = await UserStorage.getTags(tenant.id, { issuer: true }, { limit, skip });

    // Convert Sites to Locations
    for (const tag of tags.result) {
      tokens.push({
        uid: tag.id,
        type: 'RFID',
        'auth_id': tag.userID,
        'visual_number': tag.userID,
        issuer: tenant.name,
        valid: true,
        whitelist: 'ALLOWED_OFFLINE',
        'last_updated': new Date()
      });
    }

    return {
      count: tags.count,
      result: tokens
    };
  }

  /**
   * Get All OCPI Tokens from given tenant
   * @param {Tenant} tenant
   */
  static async getToken(tenant: Tenant, countryId: string, partyId: string, tokenId: string): Promise<OCPIToken> {
    // Result
    const tokens: OCPIToken[] = [];

    // Get all tokens
    const user = await UserStorage.getUserByTagId(tenant.id, tokenId);

    if (user) {
      const tag = user.tags.find((value) => value.id === tokenId);
      return {
        uid: tokenId,
        type: 'RFID',
        'auth_id': tag.userID,
        'visual_number': tag.userID,
        issuer: user.name,
        valid: !tag.deleted,
        whitelist: 'ALLOWED_OFFLINE',
        'last_updated': user.lastChangedOn
      };
    }
  }

  //
  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return Array of OCPI EVSES
   */
  static convertChargingStation2MultipleEvses(tenant: Tenant, chargingStation: ChargingStation, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OCPIEvse[] {
    // Build evse ID
    const evseID = OCPIMapping.convert2evseid(`${options.countryID}*${options.partyID}*E${chargingStation.id}`);

    // Loop through connectors and send one evse per connector
    const connectors = chargingStation.connectors.filter((connector) => connector !== null);
    const evses = connectors.map((connector: any) => {
      const evse: any = {
        'uid': `${chargingStation.id}*${connector.connectorId}`,
        'evse_id': OCPIMapping.convert2evseid(`${evseID}*${connector.connectorId}`),
        'status': OCPIMapping.convertStatus2OCPIStatus(connector.status),
        'capabilites': [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
        'connectors': [OCPIMapping.convertConnector2OCPIConnector(chargingStation, connector, evseID)]
      };
      // Check addChargeBoxID flag
      if (options && options.addChargeBoxID) {
        evse.chargeBoxId = chargingStation.id;
      }
      return evse;
    });

    // Return all evses
    return evses;
  }

  /**
   * Convert ChargingStation to Unique EVSE
   * @param {Tenant} tenant
   * @param {ChargingStation} chargingStation
   * @param options
   * @return OCPI EVSE
   */
  static convertChargingStation2UniqueEvse(tenant: Tenant, chargingStation: ChargingStation, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OCPIEvse[] {
    // Build evse id
    const evseID = OCPIMapping.convert2evseid(`${options.countryID}*${options.partyID}*E${chargingStation.id}`);

    // Get all connectors
    const connectors = chargingStation.connectors.map(
      (connector: any) => OCPIMapping.convertConnector2OCPIConnector(chargingStation, connector, evseID));

    // Build evse
    const evse: any = {
      'uid': `${chargingStation.id}`,
      'evse_id': evseID,
      'status': OCPIMapping.convertStatus2OCPIStatus(OCPIMapping.aggregateConnectorsStatus(chargingStation.connectors)),
      'capabilites': [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
      'connectors': connectors
    };

    // Check addChargeBoxID flag
    if (options && options.addChargeBoxID) {
      evse.chargeBoxId = chargingStation.id;
    }

    return [evse];
  }

  /**
   * As the status is located at EVSE object, it is necessary to aggregate status from the list
   * of connectors
   * The logic may need to be reviewed based on the list of handled status per connector
   * @param {*} connectors
   */
  static aggregateConnectorsStatus(connectors: Connector[]) {
    // Build array with charging station ordered by priority
    const statusesOrdered = [Constants.CONN_STATUS_AVAILABLE, Constants.CONN_STATUS_OCCUPIED, Constants.CONN_STATUS_CHARGING, Constants.CONN_STATUS_FAULTED];

    let aggregatedConnectorStatusIndex = 0;

    // Loop through connector
    for (const connector of connectors) {
      if (statusesOrdered.indexOf(connector.status) > aggregatedConnectorStatusIndex) {
        aggregatedConnectorStatusIndex = statusesOrdered.indexOf(connector.status);
      }
    }

    // Return value
    return statusesOrdered[aggregatedConnectorStatusIndex];
  }

  /**
   * Converter Connector to OCPI Connector
   * @param {ChargingStation} chargingStation
   * @param connector
   * @param evseID pass evse ID in order to build connector id (specs for Gireve)
   * @param {*} connector
   */
  static convertConnector2OCPIConnector(chargingStation: ChargingStation, connector: Connector, evseID: string): OCPIConnector {
    let type, format;
    switch (connector.type) {
      case 'C':
        type = OCPIConnectorType.CHADEMO;
        format = OCPIConnectorFormat.CABLE;
        break;
      case 'T2':
        type = OCPIConnectorType.IEC_62196_T2;
        format = OCPIConnectorFormat.SOCKET;
        break;
      case 'CCS':
        type = OCPIConnectorType.IEC_62196_T2_COMBO;
        format = OCPIConnectorFormat.CABLE;
        break;
    }
    return {
      'id': `${evseID}*${connector.connectorId}`,
      'standard': type,
      'format': format,
      'voltage': connector.voltage,
      'amperage': connector.amperage,
      'power_type': OCPIMapping.convertNumberofConnectedPhase2PowerType(connector.numberOfConnectedPhase),
      'last_updated': chargingStation.lastHeartBeat
    };
  }

  /**
   * Convert OCPI Connector type to connector type
   * @param {OCPIConnectorType} ocpi connector type
   */
  static convertOCPIConnectorType2ConnectorType(ocpiConnectorType: OCPIConnectorType): string {
    switch (ocpiConnectorType) {
      case OCPIConnectorType.CHADEMO:
        return Constants.CONNECTOR_TYPES.CHADEMO;
      case OCPIConnectorType.IEC_62196_T2:
        return Constants.CONNECTOR_TYPES.IEC_62196_T2;
      case OCPIConnectorType.IEC_62196_T2_COMBO:
        return Constants.CONNECTOR_TYPES.IEC_62196_T2_COMBO;
      case OCPIConnectorType.IEC_62196_T3:
      case OCPIConnectorType.IEC_62196_T3A:
        return Constants.CONNECTOR_TYPES.TYPE_3C;
      case OCPIConnectorType.IEC_62196_T1:
        return Constants.CONNECTOR_TYPES.TYPE_1;
      case OCPIConnectorType.IEC_62196_T1_COMBO:
        return Constants.CONNECTOR_TYPES.TYPE_1_CCS;
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
        return Constants.CONNECTOR_TYPES.DOMESTIC;
      default:
        return Constants.CONNECTOR_TYPES.UNKNOWN;
    }
  }

  /**
   * Convert internal Power (1/3 Phase) to PowerType
   * @param {*} power
   */
  static convertNumberofConnectedPhase2PowerType(numberOfConnectedPhase): OCPIPowerType {
    switch (numberOfConnectedPhase) {
      case 0:
        return OCPIPowerType.DC;
      case 1:
        return OCPIPowerType.AC_1_PHASE;
      case 3:
        return OCPIPowerType.AC_3_PHASE;
    }
  }

  /**
   * Convert ID to evse ID compliant to eMI3 by replacing all non alphanumeric characters tby '*'
   */
  static convert2evseid(id: string): string {
    if (id) {
      return id.replace(/[\W_]+/g, '*').toUpperCase();
    }
  }

  /**
   * Convert internal status to OCPI Status
   * @param {*} status
   */
  static convertStatus2OCPIStatus(status: string): OCPIEvseStatus {
    switch (status) {
      case Constants.CONN_STATUS_AVAILABLE:
        return OCPIEvseStatus.AVAILABLE;
      case Constants.CONN_STATUS_OCCUPIED:
        return OCPIEvseStatus.BLOCKED;
      case Constants.CONN_STATUS_CHARGING:
        return OCPIEvseStatus.CHARGING;
      case Constants.CONN_STATUS_FAULTED:
        return OCPIEvseStatus.INOPERATIVE;
      case Constants.CONN_STATUS_PREPARING:
      case Constants.CONN_STATUS_SUSPENDED_EV:
      case Constants.CONN_STATUS_SUSPENDED_EVSE:
      case Constants.CONN_STATUS_FINISHING:
        return OCPIEvseStatus.BLOCKED;
      case 'Reserved':
        return OCPIEvseStatus.RESERVED;
      default:
        return OCPIEvseStatus.UNKNOWN;
    }
  }

  /**
   * Convert internal status to OCPI Status
   * @param {*} status
   */
  static convertOCPIStatus2Status(status: OCPIEvseStatus): string {
    switch (status) {
      case OCPIEvseStatus.AVAILABLE:
        return Constants.CONN_STATUS_AVAILABLE;
      case OCPIEvseStatus.BLOCKED:
        return Constants.CONN_STATUS_OCCUPIED;
      case OCPIEvseStatus.CHARGING:
        return Constants.CONN_STATUS_CHARGING;
      case OCPIEvseStatus.INOPERATIVE:
      case OCPIEvseStatus.OUTOFORDER:
        return Constants.CONN_STATUS_FAULTED;
      case OCPIEvseStatus.PLANNED:
      case OCPIEvseStatus.RESERVED:
        return Constants.CONN_STATUS_RESERVED;
      default:
        return Constants.CONN_STATUS_UNAVAILABLE;
    }
  }

  /**
   * Check if OCPI credential object contains mandatory fields
   * @param {*} credential
   */
  static isValidOCPICredential(credential) {
    return (!credential ||
      !credential.url ||
      !credential.token ||
      !credential.party_id ||
      !credential.country_code) ? false : true;
  }

  /**
   * Build OCPI Credential Object
   * @param {*} tenant
   * @param {*} token
   */
  static async buildOCPICredentialObject(tenantID: string, token: string, role: string, versionUrl?: string) {
    // Credential
    const credential: any = {};

    // Get ocpi service configuration
    const ocpiSetting = await SettingStorage.getOCPISettings(tenantID);

    // Define version url
    credential.url = (versionUrl ? versionUrl : `https://sap-ev-ocpi-server.cfapps.eu10.hana.ondemand.com/ocpi/${role.toLowerCase()}/versions`);

    // Check if available
    if (ocpiSetting && ocpiSetting.ocpi) {
      credential.token = token;

      if (role === Constants.OCPI_ROLE.EMSP) {
        credential.country_code = ocpiSetting.ocpi.emsp.countryCode;
        credential.party_id = ocpiSetting.ocpi.emsp.partyID;
      } else {
        credential.country_code = ocpiSetting.ocpi.cpo.countryCode;
        credential.party_id = ocpiSetting.ocpi.cpo.partyID;
      }

      credential.business_details = ocpiSetting.ocpi.businessDetails;
    }

    // Return credential object
    return credential;
  }

  /**
   * Convert OCPI Endpoints
   */
  static convertEndpoints(endpointsEntity) {
    const endpoints: any = {};

    if (endpointsEntity && endpointsEntity.endpoints) {
      for (const endpoint of endpointsEntity.endpoints) {
        endpoints[endpoint.identifier] = endpoint.url;
      }
    }
    return endpoints;
  }
}
