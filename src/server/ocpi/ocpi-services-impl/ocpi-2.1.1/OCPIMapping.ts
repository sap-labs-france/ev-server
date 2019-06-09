import Constants from "../../../../utils/Constants";
import Site from "../../../../entity/Site";

require('source-map-support').install();

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
  static async convertSite2Location(tenant: any, site: any, options: any = {}) {
    if (site instanceof Site) {
      // build object
      return {
        "id": site.getID(),
        "name": site.getName(),
        "address": `${site.getAddress().address1} ${site.getAddress().address2}`,
        "city": site.getAddress().city,
        "postal_code": site.getAddress().postalCode,
        "country": site.getAddress().country,
        "coordinates": {
          "latitude": site.getAddress().latitude,
          "longitude": site.getAddress().longitude
        },
        "evses": await this.getEvsesFromSite(tenant, site, options),
        "last_updated": site.getLastChangedOn()
      };
    }
  }

  /**
   * Get Evses from SiteArea
   * @param {Tenant} tenant
   * @param {SiteArea} siteArea
   * @return Array of OCPI EVSES
   */
  static async getEvsesFromSiteaArea(tenant: any, siteArea: any, options: any) {
    // build evses array
    const evses: any = [];

    // get charging stations from SiteArea
    const chargingStations = await siteArea.getChargingStations();

    // convert charging stations to evse(s)
    chargingStations.forEach((chargingStation: any) => {
      if (chargingStation.canChargeInParallel()) {
        evses.push(...this.convertCharginStation2MultipleEvses(tenant, chargingStation, options));
      } else {
        evses.push(...this.convertChargingStation2UniqueEvse(tenant, chargingStation, options));
      }
    });

    // return evses
    return evses;
  }

  /**
 * Get Evses from Site
 * @param {Tenant} tenant
 * @param {Site} site
 * @param options
 * @return Array of OCPI EVSES
 */
  static async getEvsesFromSite(tenant: any, site: any, options: any) {
    // build evses array
    const evses = [];
    const siteAreas = await site.getSiteAreas();

    for (const siteArea of siteAreas) {
      // get charging stations from SiteArea
      evses.push(...await this.getEvsesFromSiteaArea(tenant, siteArea, options));
    }

    // return evses
    return evses;
  }

  /**
   * Get All OCPI Locations from given tenant
   * @param {Tenant} tenant
   */
  static async getAllLocations(tenant: any, limit: any, skip: any, options: any) {
    // result
    const result: any = { count: 0, locations: [] };

    // Get all sites
    const sites = await Site.getSites(tenant.getID(), {}, limit, skip, null);

    // convert Sites to Locations
    for (const site of sites.result) {
      result.locations.push(await this.convertSite2Location(tenant, site, options));
    }

    // set count
    result.count = sites.count;

    // return locations
    return result;
  }

  //
  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @return Array of OCPI EVSES
   */
  static convertCharginStation2MultipleEvses(tenant: any, chargingStation: any, options: any) {
    // evse_id
    const evse_id = this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.getID()}`);

    // loop through connectors and send one evse per connector
    const evses = chargingStation.getConnectors().map((connector: any) => {
      const evse: any = {
        "uid": `${chargingStation.getID()}*${connector.connectorId}`,
        "id": this.convert2evseid(`${evse_id}*${connector.connectorId}`),
        "status": this.convertStatus2OCPIStatus(connector.status),
        "connectors": [this.convertConnector2OCPIConnector(chargingStation, connector, evse_id)]
      };

      // check addChargeBoxID flag
      if (options && options.addChargeBoxID) {
        evse.chargeBoxId = chargingStation.getID();
      }

      return evse;
    });

    // return all evses
    return evses;
  }

  /**
   * Convert ChargingStation to Unique EVSE
   * @param {Tenant} tenant
   * @param {ChargingStation} chargingStation
   * @param options
   * @return OCPI EVSE
   */
  static convertChargingStation2UniqueEvse(tenant: any, chargingStation: any, options: any) {
    // build evse_id
    const evse_id = this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.getID()}`);

    // Get all connectors
    const connectors = chargingStation.getConnectors().map((connector: any) => {
      return this.convertConnector2OCPIConnector(chargingStation, connector, evse_id);
    });

    // build evse
    const evse: any = {
      "uid": `${chargingStation.getID()}`,
      // "id": this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.getID()}`),
      "id": evse_id,
      "status": this.convertStatus2OCPIStatus(this.aggregateConnectorsStatus(connectors)),
      "connectors": connectors
    };

    // check addChargeBoxID flag
    if (options && options.addChargeBoxID) {
      evse.chargeBoxId = chargingStation.getID();
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

    // loop through connector
    for (const connector of connectors) {
      if (statusesOrdered.indexOf(connector.status) > aggregatedConnectorStatusIndex) {
        aggregatedConnectorStatusIndex = statusesOrdered.indexOf(connector.status);
      }
    }

    // return value
    return statusesOrdered[aggregatedConnectorStatusIndex];
  }

  /**
   * Converter Connector to OCPI Connector
   * @param {ChargingStation} chargingStation
   * @param connector
   * @param evse_id pass evse_id in order to buid connector id (specs for Gireve)
   * @param {*} connector
   */
  static convertConnector2OCPIConnector(chargingStation: any, connector: any, evse_id: any) {
    return {
      "id": `${evse_id}*${connector.connectorId}`,
      "type": Constants.MAPPING_CONNECTOR_TYPE[connector.type],
      "voltage": connector.voltage,
      "amperage": connector.amperage,
      "power_type": this.convertNumberofConnectedPhase2PowerType(chargingStation.getNumberOfConnectedPhase()),
      "last_update": chargingStation.getLastHeartBeat()
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
    if (id != null && id != "") {
      return id.replace(/[\W_]+/g, "*").toUpperCase();
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
      case "Preparing":
      case "SuspendedEV":
      case "SuspendedEVSE":
      case "Finishing":
      case "Reserved":
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
   * build OCPI Credential Object
   * @param {*} tenant
   * @param {*} token
   */
  static async buildOCPICredentialObject(tenant, token, versionUrl?) {
    // credentail
    const credential: any = {};

    // get ocpi service configuration
    const ocpiSetting = await tenant.getSetting(Constants.COMPONENTS.OCPI);

    // define version url
    credential.url = (versionUrl ? versionUrl : 'https://sap-ev-ocpi-server.cfapps.eu10.hana.ondemand.com/ocpi/cpo/versions');

    // check if available
    if (ocpiSetting && ocpiSetting.getContent()) {
      const configuration = ocpiSetting.getContent().ocpi;
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

    // return credential object
    return credential;
  }

  /**
   * convert OCPI Endpoints
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
