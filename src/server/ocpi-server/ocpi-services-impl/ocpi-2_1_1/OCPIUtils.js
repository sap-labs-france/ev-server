const OCPIConstants = require("../../OCPIConstants");

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
   * Get Evses from SiteArea
   * @param {SiteArea} siteArea 
   * @return Array of OCPI EVSES
   */
  static async getEvsesFromSiteaArea(siteArea) {
    // build evses array
    const evses = [];

    // get charging stations from SiteArea
    const chargingStations = await siteArea.getChargingStations();

    // convert charging stations to evse(s)
    chargingStations.forEach(chargingStation => {
      if (chargingStation.canChargeInParallel()) {
        evses.push(this.convetCharginStation2MultipleEvses(chargingStation));
      } else {
        evses.push(this.convertChargingStation2UniqueEvse(chargingStation));
      }
    });

    // return evses
    return evses;
  }

  // 
  /**
   * Convert ChargingStation to Multiple EVSEs
   * @param {*} chargingStation 
   * @return Array of OCPI EVSES
   */
  static convetCharginStation2MultipleEvses(chargingStation) {
    const evses = [];

    // loop through connectors and send one evse per connector
    chargingStation.getConnectors().forEach(connector => {
      evses.push({
        "uid": `${chargingStation.getID()}_${connector.connectorId}`,
        "id": `FR-SLF-E${chargingStation.getID()}_${connector.connectorId}`,
        "status": OCPIConstants.MAPPING_EVSE_STATUS[connector.status],
        "connectors": [ this.convertConnector2OCPIConnector(connector) ]
      })
    });

    // return all evses
    return evses;
  }

  /**
   * Convert ChargingStation to Unique EVSE
   * @param {ChargingStation} chargingStation 
   * @return OCPI EVSE
   */
  static convertChargingStation2UniqueEvse(chargingStation) {
    // Get all connectors
    const connectors = chargingStation.getConnectors().map(connector => {
      return this.convertConnector2OCPIConnector(connector);
    })

    // build evse
    return [{
      "uid": `${chargingStation.getID()}`,
      "id": `FR-SLF-E${chargingStation.getID()}`,
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

}

module.exports = OCPIUtils;