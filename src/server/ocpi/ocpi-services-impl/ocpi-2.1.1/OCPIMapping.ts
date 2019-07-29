import Constants from '../../../../utils/Constants';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import ChargingStation from '../../../../types/ChargingStation';
import Tenant from '../../../../types/Tenant';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';

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
  static async convertSite2Location(tenant: Tenant, site: Site, options: any = {}) {
    // Build object
    return {
      'id': site.id,
      'name': site.name,
      'address': `${site.address.address1} ${site.address.address2}`,
      'city': site.address.city,
      'postal_code': site.address.postalCode,
      'country': site.address.country,
      'coordinates': {
        'latitude': site.address.latitude,
        'longitude': site.address.longitude
      },
      'evses': await OCPIMapping.getEvsesFromSite(tenant, site, options),
      'last_updated': site.lastChangedOn
    };
  }

  /**
   * Get Evses from SiteArea
   * @param {Tenant} tenant
   * @param {SiteArea} siteArea
   * @return Array of OCPI EVSES
   */
  static async getEvsesFromSiteaArea(tenant: Tenant, siteArea: SiteArea, options: any) {
    // Build evses array
    const evses: any = [];

    // Get charging stations from SiteArea
    const chargingStations = await siteArea.chargingStations;

    // Convert charging stations to evse(s)
    chargingStations.forEach((chargingStation) => {
      if (!chargingStation.cannotChargeInParallel) {
        evses.push(...OCPIMapping.convertCharginStation2MultipleEvses(tenant, chargingStation, options));
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
  static async getEvsesFromSite(tenant: Tenant, site: Site, options: any) {
    // Build evses array
    const evses = [];
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id, { withChargeBoxes: true, siteIDs: [site.id] },
      Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      // Get charging stations from SiteArea
      evses.push(...await OCPIMapping.getEvsesFromSiteaArea(tenant, siteArea, options));
    }

    // Return evses
    return evses;
  }

  /**
   * Get All OCPI Locations from given tenant
   * @param {Tenant} tenant
   */
  static async getAllLocations(tenant: Tenant, limit: any, skip: any, options: any) {
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

  //
  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return Array of OCPI EVSES
   */
  static convertCharginStation2MultipleEvses(tenant: Tenant, chargingStation: ChargingStation, options: any) {
    // Build evse_id
    const evse_id = OCPIMapping.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.id}`);

    // Loop through connectors and send one evse per connector
    const connectors = chargingStation.connectors.filter((connector) => {
      return connector !== null;
    });
    const evses = connectors.map((connector: any) => {
      const evse: any = {
        'uid': `${chargingStation.id}*${connector.connectorId}`,
        'id': OCPIMapping.convert2evseid(`${evse_id}*${connector.connectorId}`),
        'status': OCPIMapping.convertStatus2OCPIStatus(connector.status),
        'connectors': [OCPIMapping.convertConnector2OCPIConnector(chargingStation, connector, evse_id)]
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
  static convertChargingStation2UniqueEvse(tenant: Tenant, chargingStation: ChargingStation, options: any) {
    // Build evse_id
    const evse_id = OCPIMapping.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.id}`);

    // Get all connectors
    const connectors = chargingStation.connectors.map((connector: any) => {
      return OCPIMapping.convertConnector2OCPIConnector(chargingStation, connector, evse_id);
    });

    // Build evse
    const evse: any = {
      'uid': `${chargingStation.id}`,
      // "id": this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.id}`),
      'id': evse_id,
      'status': OCPIMapping.convertStatus2OCPIStatus(OCPIMapping.aggregateConnectorsStatus(connectors)),
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
  static aggregateConnectorsStatus(connectors: any) {
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
   * @param evse_id pass evse_id in order to buid connector id (specs for Gireve)
   * @param {*} connector
   */
  static convertConnector2OCPIConnector(chargingStation: ChargingStation, connector: any, evse_id: any) {
    return {
      'id': `${evse_id}*${connector.connectorId}`,
      'type': Constants.MAPPING_CONNECTOR_TYPE[connector.type],
      'voltage': connector.voltage,
      'amperage': connector.amperage,
      'power_type': OCPIMapping.convertNumberofConnectedPhase2PowerType(chargingStation.numberOfConnectedPhase),
      'last_update': chargingStation.lastHeartBeat
    };
  }

  /**
   * Convert internal Power (1/3 Phase) to PowerType
   * @param {*} power
   */
  static convertNumberofConnectedPhase2PowerType(numberOfConnectedPhase) {
    switch (numberOfConnectedPhase) {
      case 0:
        return Constants.CONNECTOR_POWER_TYPE.DC;
      case 1:
        return Constants.CONNECTOR_POWER_TYPE.AC_1_PHASE;
      case 3:
        return Constants.CONNECTOR_POWER_TYPE.AC_3_PHASE;
    }
  }

  /**
   * Convert ID to EVSE_ID compliant to eMI3 by replacing all non alphanumeric characters tby '*'
   */
  static convert2evseid(id: any) {
    if (id) {
      return id.replace(/[\W_]+/g, '*').toUpperCase();
    }
  }

  /**
   * Convert internal status to OCPI Status
   * @param {*} status
   */
  static convertStatus2OCPIStatus(status) {
    switch (status) {
      case Constants.CONN_STATUS_AVAILABLE:
        return Constants.EVSE_STATUS.AVAILABLE;
      case Constants.CONN_STATUS_OCCUPIED:
        return Constants.EVSE_STATUS.BLOCKED;
      case Constants.CONN_STATUS_CHARGING:
        return Constants.EVSE_STATUS.CHARGING;
      case Constants.CONN_STATUS_FAULTED:
        return Constants.EVSE_STATUS.INOPERATIVE;
      case 'Preparing':
      case 'SuspendedEV':
      case 'SuspendedEVSE':
      case 'Finishing':
      case 'Reserved':
        return Constants.EVSE_STATUS.BLOCKED;
      default:
        return Constants.EVSE_STATUS.UNKNOWN;
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
  static async buildOCPICredentialObject(tenant: Tenant, token, versionUrl?) {
    // Credential
    const credential: any = {};

    // Get ocpi service configuration
    const ocpiSetting = await SettingStorage.getSettingByIdentifier(tenant.id, Constants.COMPONENTS.OCPI);

    // Define version url
    credential.url = (versionUrl ? versionUrl : 'https://sap-ev-ocpi-server.cfapps.eu10.hana.ondemand.com/ocpi/cpo/versions');

    // Check if available
    if (ocpiSetting && ocpiSetting.content) {
      const configuration = ocpiSetting.content.ocpi;
      credential.token = token;
      credential.country_code = configuration.countryCode;
      credential.party_id = configuration.partyID;
      credential.business_details = configuration.businessDetails;
    } else {
      // TODO: remove this - temporary configuration to handle non existing service.
      credential.token = 'eyAiYSI6IDEgLCAidGVuYW50IjogInNsZiIgfQ==';
      credential.country_code = 'FR';
      credential.party_id = 'SLF';
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
