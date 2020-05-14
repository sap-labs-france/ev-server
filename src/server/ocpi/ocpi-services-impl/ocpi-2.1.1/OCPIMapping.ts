import { CdrDimensionType, OCPIChargingPeriod } from '../../../../types/ocpi/OCPIChargingPeriod';
import ChargingStation, { Connector, ConnectorType } from '../../../../types/ChargingStation';
import { OCPICapability, OCPIEvse, OCPIEvseStatus } from '../../../../types/ocpi/OCPIEvse';
import { OCPIConnector, OCPIConnectorFormat, OCPIConnectorType, OCPIPowerType } from '../../../../types/ocpi/OCPIConnector';
import { OCPILocation, OCPILocationType } from '../../../../types/ocpi/OCPILocation';
import { OCPIToken, OCPITokenType, OCPITokenWhitelist } from '../../../../types/ocpi/OCPIToken';

import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import Configuration from '../../../../utils/Configuration';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import { DataResult } from '../../../../types/DataResult';
import { OCPICdr } from '../../../../types/ocpi/OCPICdr';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import { OCPISession } from '../../../../types/ocpi/OCPISession';
import OCPIUtils from '../../OCPIUtils';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import Tenant from '../../../../types/Tenant';
import Transaction from '../../../../types/Transaction';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import moment from 'moment';

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
      'last_updated': site.lastChangedOn ? site.lastChangedOn : site.createdOn
    };
  }

  static convertEvseToChargingStation(evseId: string, evse: Partial<OCPIEvse>, location?: OCPILocation): ChargingStation {
    const chargingStation: ChargingStation = {
      id: evseId,
      maximumPower: 0,
      cannotChargeInParallel: true,
      issuer: false,
      connectors: [],
      chargeBoxSerialNumber: evse.evse_id,
      imsi: evse.uid,
      iccid: location.id,
      ocpiData: {
        evse: evse
      }
    } as ChargingStation;
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
          id: ocpiConnector.id,
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
      if (chargingStation.issuer === true && !chargingStation.private) {
        if (!chargingStation.cannotChargeInParallel) {
          evses.push(...OCPIMapping.convertChargingStation2MultipleEvses(tenant, chargingStation, options));
        } else {
          evses.push(...OCPIMapping.convertChargingStation2UniqueEvse(tenant, chargingStation, options));
        }
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
        withChargingStations: true,
        siteIDs: [site.id],
        issuer: true
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
    const sites = await SiteStorage.getSites(tenant.id, { issuer: true }, { limit, skip });
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
  static async getAllTokens(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPIToken>> {
    // Result
    const tokens: OCPIToken[] = [];
    // Get all tokens
    const tags = await UserStorage.getTags(tenant.id, { issuer: true, dateFrom, dateTo }, {
      limit,
      skip
    });
    // Convert Sites to Locations
    for (const tag of tags.result) {
      const user = await UserStorage.getUser(tenant.id, tag.userID);
      const valid = user && !user.deleted;
      tokens.push({
        uid: tag.id,
        type: OCPITokenType.RFID,
        // eslint-disable-next-line @typescript-eslint/camelcase
        auth_id: tag.userID,
        // eslint-disable-next-line @typescript-eslint/camelcase
        visual_number: tag.userID,
        issuer: tenant.name,
        valid: valid,
        whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
        // eslint-disable-next-line @typescript-eslint/camelcase
        last_updated: tag.lastChangedOn ? tag.lastChangedOn : new Date()
      });
    }
    return {
      count: tags.count,
      result: tokens
    };
  }

  /**
   * Get All OCPI Session from given tenant
   * @param {Tenant} tenant
   */
  static async getAllSessions(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPISession>> {
    // Result
    const sessions: OCPISession[] = [];
    // Get all transactions
    const transactions = await TransactionStorage.getTransactions(tenant.id, { issuer: true, ocpiSessionDateFrom: dateFrom, ocpiSessionDateTo: dateTo }, {
      limit,
      skip
    });
    for (const transaction of transactions.result) {
      sessions.push(transaction.ocpiData.session);
    }
    return {
      count: transactions.count,
      result: sessions
    };
  }

  /**
   * Get All OCPI Cdrs from given tenant
   * @param {Tenant} tenant
   */
  static async getAllCdrs(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPICdr>> {
    // Result
    const cdrs: OCPICdr[] = [];
    // Get all transactions
    const transactions = await TransactionStorage.getTransactions(tenant.id, { issuer: true, ocpiCdrDateFrom: dateFrom, ocpiCdrDateTo: dateTo }, {
      limit,
      skip
    });
    for (const transaction of transactions.result) {
      if (transaction.ocpiData && transaction.ocpiData.cdr) {
        cdrs.push(transaction.ocpiData.cdr);
      }
    }
    return {
      count: transactions.count,
      result: cdrs
    };
  }

  /**
   * Get All OCPI Tokens from given tenant
   * @param {Tenant} tenant
   */
  static async getToken(tenant: Tenant, countryId: string, partyId: string, tokenId: string): Promise<OCPIToken> {
    const user = await UserStorage.getUserByTagId(tenant.id, tokenId);
    if (user) {
      const tag = user.tags.find((value) => value.id === tokenId);
      if (!user.issuer && user.name === OCPIUtils.buildOperatorName(countryId, partyId) && tag.ocpiToken) {
        return tag.ocpiToken;
      }
    }
  }

  /**
   * Map user locale (en_US, fr_FR...) to ocpi language (en, fr...)
   * @param locale
   */
  static convertLocaleToLanguage(locale: string): string {
    if (!locale || locale.length < 2) {
      return null;
    }
    return locale.substring(0, 2);
  }

  /**
   * Map ocpi language (en, fr...) to user locale (en_US, fr_FR...)
   * @param locale
   */
  static convertLanguageToLocale(language: string): string {
    if (language === 'fr') {
      return 'fr_FR';
    }
    return 'en_US';
  }

  //
  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return Array of OCPI EVSES
   */
  static convertChargingStation2MultipleEvses(tenant: Tenant, chargingStation: ChargingStation, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OCPIEvse[] {
    // Loop through connectors and send one evse per connector
    const connectors = chargingStation.connectors.filter((connector) => connector !== null);
    const evses = connectors.map((connector) => {
      const evseID = OCPIUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector);
      const evse: any = {
        'uid': OCPIUtils.buildEvseUID(chargingStation, connector),
        'evse_id': evseID,
        'status': OCPIMapping.convertStatus2OCPIStatus(connector.status),
        'capabilites': [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
        'connectors': [OCPIMapping.convertConnector2OCPIConnector(chargingStation, connector, evseID)],
        'last_updated': chargingStation.lastHeartBeat
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
    const evseID = OCPIUtils.buildEvseID(options.countryID, options.partyID, chargingStation);
    // Get all connectors
    const connectors = chargingStation.connectors.map(
      (connector: any) => OCPIMapping.convertConnector2OCPIConnector(chargingStation, connector, evseID));
    // Build evse
    const evse: any = {
      'uid': OCPIUtils.buildEvseUID(chargingStation),
      'evse_id': evseID,
      'status': OCPIMapping.convertStatus2OCPIStatus(OCPIMapping.aggregateConnectorsStatus(chargingStation.connectors)),
      'capabilities': [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
      'connectors': connectors,
      'last_updated': chargingStation.lastHeartBeat
    };
    // Check addChargeBoxID flag
    if (options && options.addChargeBoxID) {
      evse.chargeBoxId = chargingStation.id;
    }
    return [evse];
  }

  static convertChargingStationToOCPILocation(site: Site, chargingStation: ChargingStation, connectorId: number, countryId: string, partyId: string): OCPILocation {
    const evseID = OCPIUtils.buildEvseID(countryId, partyId, chargingStation);
    const connectors: OCPIConnector[] = [];
    let status: ChargePointStatus;
    for (const chargingStationConnector of chargingStation.connectors) {
      if (chargingStationConnector.connectorId === connectorId) {
        connectors.push(OCPIMapping.convertConnector2OCPIConnector(chargingStation, chargingStationConnector, evseID));
        status = chargingStationConnector.status;
        break;
      }
    }
    const ocpiLocation: OCPILocation = {
      id: site.id,
      name: site.name,
      address: `${site.address.address1} ${site.address.address2}`,
      city: site.address.city,
      // eslint-disable-next-line @typescript-eslint/camelcase
      postal_code: site.address.postalCode,
      country: site.address.country,
      coordinates: {
        latitude: site.address.coordinates[1].toString(),
        longitude: site.address.coordinates[0].toString()
      },
      type: OCPILocationType.UNKNOWN,
      evses: [{
        uid: OCPIUtils.buildEvseUID(chargingStation),
        // eslint-disable-next-line @typescript-eslint/camelcase
        evse_id: evseID,
        status: OCPIMapping.convertStatus2OCPIStatus(status),
        capabilities: [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
        connectors: connectors,
        coordinates: {
          latitude: chargingStation.coordinates[1].toString(),
          longitude: chargingStation.coordinates[0].toString()
        },
        // eslint-disable-next-line @typescript-eslint/camelcase
        last_updated: chargingStation.lastHeartBeat
      }],
      // eslint-disable-next-line @typescript-eslint/camelcase
      last_updated: site.lastChangedOn ? site.lastChangedOn : site.createdOn
    };
    return ocpiLocation;
  }

  /**
   * As the status is located at EVSE object, it is necessary to aggregate status from the list
   * of connectors
   * The logic may need to be reviewed based on the list of handled status per connector
   * @param {*} connectors
   */
  static aggregateConnectorsStatus(connectors: Connector[]): ChargePointStatus {
    // Build array with charging station ordered by priority
    const statusesOrdered: ChargePointStatus[] = [ChargePointStatus.AVAILABLE, ChargePointStatus.OCCUPIED, ChargePointStatus.CHARGING, ChargePointStatus.FAULTED];
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
  static convertOCPIConnectorType2ConnectorType(ocpiConnectorType: OCPIConnectorType): ConnectorType {
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
  static convertStatus2OCPIStatus(status: ChargePointStatus): OCPIEvseStatus {
    switch (status) {
      case ChargePointStatus.AVAILABLE:
        return OCPIEvseStatus.AVAILABLE;
      case ChargePointStatus.OCCUPIED:
        return OCPIEvseStatus.BLOCKED;
      case ChargePointStatus.CHARGING:
        return OCPIEvseStatus.CHARGING;
      case ChargePointStatus.FAULTED:
        return OCPIEvseStatus.INOPERATIVE;
      case ChargePointStatus.PREPARING:
      case ChargePointStatus.SUSPENDED_EV:
      case ChargePointStatus.SUSPENDED_EVSE:
      case ChargePointStatus.FINISHING:
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
  static convertOCPIStatus2Status(status: OCPIEvseStatus): ChargePointStatus {
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

  static async buildChargingPeriods(tenantID: string, transaction: Transaction): Promise<OCPIChargingPeriod[]> {
    if (!transaction || !transaction.timestamp) {
      return [];
    }
    const chargingPeriods: OCPIChargingPeriod[] = [];
    const consumptions = await ConsumptionStorage.getOptimizedTransactionConsumptions(tenantID, { transactionId: transaction.id });
    if (consumptions) {
      for (const consumption of consumptions) {
        const chargingPeriod = this.buildChargingPeriod(consumption);
        if (chargingPeriod && chargingPeriod.dimensions && chargingPeriod.dimensions.length > 0) {
          chargingPeriods.push(chargingPeriod);
        }
      }
    } else {
      const consumption: number = transaction.stop ? transaction.stop.totalConsumption : transaction.currentTotalConsumption;
      chargingPeriods.push({
        // eslint-disable-next-line @typescript-eslint/camelcase
        start_date_time: transaction.timestamp,
        dimensions: [{
          type: CdrDimensionType.ENERGY,
          volume: consumption / 1000
        }]
      });
      const inactivity: number = transaction.stop ? transaction.stop.totalInactivitySecs : transaction.currentTotalInactivitySecs;
      if (inactivity > 0) {
        const inactivityStart = transaction.stop ? transaction.stop.timestamp : transaction.lastUpdate;
        chargingPeriods.push({
          // eslint-disable-next-line @typescript-eslint/camelcase
          start_date_time: moment(inactivityStart).subtract(inactivity, 'seconds').toDate(),
          dimensions: [{
            type: CdrDimensionType.PARKING_TIME,
            volume: parseFloat((inactivity / 3600).toFixed(3))
          }]
        });
      }
    }
    return chargingPeriods;
  }

  static buildChargingPeriod(consumption: Consumption): OCPIChargingPeriod {
    const chargingPeriod: OCPIChargingPeriod = {
      // eslint-disable-next-line @typescript-eslint/camelcase
      start_date_time: consumption.startedAt,
      dimensions: []
    };
    if (consumption.consumption > 0) {
      chargingPeriod.dimensions.push({
        type: CdrDimensionType.ENERGY,
        volume: consumption.consumption / 1000
      });
      if (consumption.limitAmps > 0) {
        chargingPeriod.dimensions.push({
          type: CdrDimensionType.MAX_CURRENT,
          volume: consumption.limitAmps
        });
      }
    } else {
      const duration: number = moment(consumption.endedAt).diff(consumption.startedAt, 'hours', true);
      if (duration > 0) {
        chargingPeriod.dimensions.push({
          type: CdrDimensionType.PARKING_TIME,
          volume: parseFloat(duration.toFixed(3))
        });
      }
    }
    return chargingPeriod;
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
    credential.url = (versionUrl ? versionUrl : `${Configuration.getOCPIEndpointConfig().baseUrl}/ocpi/${role.toLowerCase()}/versions`);
    // Check if available
    if (ocpiSetting && ocpiSetting.ocpi) {
      credential.token = token;
      if (role === OCPIRole.EMSP) {
        // eslint-disable-next-line @typescript-eslint/camelcase
        credential.country_code = ocpiSetting.ocpi.emsp.countryCode;
        // eslint-disable-next-line @typescript-eslint/camelcase
        credential.party_id = ocpiSetting.ocpi.emsp.partyID;
      } else {
        // eslint-disable-next-line @typescript-eslint/camelcase
        credential.country_code = ocpiSetting.ocpi.cpo.countryCode;
        // eslint-disable-next-line @typescript-eslint/camelcase
        credential.party_id = ocpiSetting.ocpi.cpo.partyID;
      }
      // eslint-disable-next-line @typescript-eslint/camelcase
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
