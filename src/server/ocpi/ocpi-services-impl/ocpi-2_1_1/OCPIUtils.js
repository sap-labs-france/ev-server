const OCPIConstants = require("../../OCPIConstants");
const Constants = require("../../../../utils/Constants");

require('source-map-support').install();

/**
 * OCPI Utils 2.1.1 - Utility class
 * Mainly contains helper functions to convert internal entity to OCPI 2.1.1 Entity
 */
class OCPIUtils {
  /**
   * Convert SiteArea to OCPI Location
   * @param {SiteArea} siteArea 
   * @return OCPI Location
   */
  static async convertSiteArea2Location(siteArea) {
    // Get Site
    const site = await siteArea.getSite();

    // build object
    return {
      "id": siteArea.getID(),
      "type": "UNKNOWN",
      "name": siteArea.getName(),
      "address": `${site.getAddress().address1} ${site.getAddress().address2}`,
      "city": site.getAddress().city,
      "postal_code": site.getAddress().postalCode,
      "country": site.getAddress().country,
      " coordinates": {
        "latitude": site.getAddress().latitude,
        "longitude": site.getAddress().longitude
      },
      "evses": await this.getEvsesFromSiteaArea(siteArea)
    };
  }

  /**
   * Convert Site to OCPI Location
   * @param {Tenant} tenant
   * @param {Site} site 
   * @return OCPI Location
   */
  static async convertSite2Location(tenant, site) {
    // build object
    return {
      "id": site.getID(),
      "type": "UNKNOWN",
      "name": site.getName(),
      "address": `${site.getAddress().address1} ${site.getAddress().address2}`,
      "city": site.getAddress().city,
      "postal_code": site.getAddress().postalCode,
      "country": site.getAddress().country,
      " coordinates": {
        "latitude": site.getAddress().latitude,
        "longitude": site.getAddress().longitude
      },
      "evses": await this.getEvsesFromSite(tenant, site),
      // "charging_when_closed": false,
      "last_updated": new Date().toISOString()
    };
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
        "uid": `${chargingStation.getID()}_${connector.connectorId}`,
        "id": this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.getID()}*${connector.connectorId}`),
        "status": this.convertStatus2OCPIStatus(connector.status),
        "connectors": [this.convertConnector2OCPIConnector(connector)]
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
      return this.convertConnector2OCPIConnector(connector);
    })

    // build evse
    return [{
      "uid": `${chargingStation.getID()}`,
      "id": this.convert2evseid(`${tenant._eMI3.country_id}*${tenant._eMI3.party_id}*E${chargingStation.getID()}`),
      "status": "AVAILABLE", // TODO: get status of connector
      "connectors": connectors
    }];
  }

  /**
   * Converter Connector to OCPI Connector
   * @param {*} connector 
   */
  static convertConnector2OCPIConnector(connector) {
    return {
      "id": connector.connectorId,
      "type": OCPIConstants.MAPPING_CONNECTOR_TYPE[connector.type]
    }
  }

  /**
   * Convert ID to EVSE_ID compliant to eMI3 by replacing all non alphanumeric characters tby '*'
   */
  static convert2evseid(id) {
    if (id != null && id != "") {
      return id.replace(/[\W_]+/g,"*").toLowerCase();
    }
  }

  /**
   * Convert internal status to OCPI Status
   * @param {*} status 
   */
  static convertStatus2OCPIStatus(status) {
    switch (status) {
      case Constants.CONN_STATUS_AVAILABLE:
        return OCPIConstants.EVSE_STATUS.AVAILABLE;
      case Constants.CONN_STATUS_OCCUPIED:
        return OCPIConstants.EVSE_STATUS.BLOCKED;
      case "Charging":
        return OCPIConstants.EVSE_STATUS.CHARGING;
      case "Faulted":
        return OCPIConstants.EVSE_STATUS.INOPERATIVE;
      case "Preparing":
      case "SuspendedEV":
      case "SuspendedEVSE":
      case "Finishing":
      case "Reserved":
        return OCPIConstants.EVSE_STATUS.UNKNOWN;
      default:
        return OCPIConstants.EVSE_STATUS.UNKNOWN;
    }
  }

}

module.exports = OCPIUtils;