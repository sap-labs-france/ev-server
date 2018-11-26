const Constants = require("../../../../utils/Constants");
const Site = require("../../../../entity/Site");

require('source-map-support').install();

/**
 * OCPI Mapping 2.1.1 - Mapping class
 * Mainly contains helper functions to convert internal entity to OCPI 2.1.1 Entity
 */
class OCPIMapping {
  /**
   * Convert Site to OCPI Location
   * @param {Tenant} tenant
   * @param {Site} site 
   * @return OCPI Location
   */
  static async convertSite2Location(tenant, site) {
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
        "evses": await this.getEvsesFromSite(tenant, site),
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
  static async getEvsesFromSiteaArea(tenant, siteArea) {
    // build evses array
    const evses = [];

    // get charging stations from SiteArea
    const chargingStations = await siteArea.getChargingStations();

    // convert charging stations to evse(s)
    chargingStations.forEach(chargingStation => {
      if (chargingStation.canChargeInParallel()) {
        evses.push(...this.convertCharginStation2MultipleEvses(tenant, chargingStation));
      } else {
        evses.push(...this.convertChargingStation2UniqueEvse(tenant, chargingStation));
      }
    });

    // return evses
    return evses;
  }

  /**
 * Get Evses from Site
 * @param {Tenant} tenant
 * @param {Site} site
 * @return Array of OCPI EVSES
 */
  static async getEvsesFromSite(tenant, site) {
    // build evses array
    const evses = [];
    const siteAreas = await site.getSiteAreas();

    for (const siteArea of siteAreas) {
      // get charging stations from SiteArea
      evses.push(...await this.getEvsesFromSiteaArea(tenant, siteArea));
    }

    // return evses
    return evses;
  }

  // 
  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {Tenant} tenant
   * @param {*} chargingStation 
   * @return Array of OCPI EVSES
   */
  static convertCharginStation2MultipleEvses(tenant, chargingStation) {
    // loop through connectors and send one evse per connector
    const evses = chargingStation.getConnectors().map(connector => {
      return {
        "uid": `${chargingStation.getID()}*${connector.connectorId}`,
        "id": this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.getID()}*${connector.connectorId}`),
        "status": this.convertStatus2OCPIStatus(connector.status),
        "connectors": [this.convertConnector2OCPIConnector(chargingStation, connector)]
      }
    });

    // return all evses
    return evses;
  }

  /**
   * Convert ChargingStation to Unique EVSE
   * @param {Tenant} tenant
   * @param {ChargingStation} chargingStation 
   * @return OCPI EVSE
   */
  static convertChargingStation2UniqueEvse(tenant, chargingStation) {
    // Get all connectors
    const connectors = chargingStation.getConnectors().map(connector => {
      return this.convertConnector2OCPIConnector(chargingStation, connector);
    })

    // build evse
    return [{
      "uid": `${chargingStation.getID()}`,
      "id": this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.getID()}`),
      "status": this.convertStatus2OCPIStatus(this.aggregateConnectorsStatus(connectors)),
      "connectors": connectors
    }];
  }

  /**
   * As the status is located at EVSE object, it is necessary to aggregate status from the list
   * of connectors
   * The logic may need to be reviewed based on the list of handled status per connector
   * @param {*} connectors 
   */
  static aggregateConnectorsStatus(connectors) {
    // Build array with charging station ordered by priority
    const statusesOrdered = [Constants.CONN_STATUS_AVAILABLE, Constants.CONN_STATUS_OCCUPIED,Constants.CONN_STATUS_CHARGING, Constants.CONN_STATUS_FAULTED];

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
   * @param {*} connector 
   */
  static convertConnector2OCPIConnector(chargingStation, connector) {
    return {
      "id": connector.connectorId,
      "type": Constants.MAPPING_CONNECTOR_TYPE[connector.type],
      "power_type": this.convertNumberofConnectedPhase2PowerType(chargingStation.getNumberOfConnectedPhase()),
      "last_update": chargingStation.getLastHeartBeat()
    }
  }

  /**
   * Convert internal Power (1/3 Phase) to PowerType
   * @param {*} power 
   */
  static convertNumberofConnectedPhase2PowerType(numberOfConnectedPhase) {
    switch (numberOfConnectedPhase) {
      case 1:
        return Constants.CONNECTOR_POWER_TYPE.AC_1_PHASE;
      case 3:
        return Constants.CONNECTOR_POWER_TYPE.AC_3_PHASE;
    }
  }

  /**
   * Convert ID to EVSE_ID compliant to eMI3 by replacing all non alphanumeric characters tby '*'
   */
  static convert2evseid(id) {
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
}



module.exports = OCPIMapping;