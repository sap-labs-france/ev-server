const Constants = require('../utils/Constants');
const Configuration = require('../utils/Configuration');
const BackendError = require('../exception/BackendError');

class ChargingStationClient {
  constructor() {
    if (new.target === ChargingStationClient) {
      throw new TypeError("Cannot construct ChargingStationClient instances directly");
    }
  }

  /**
   *
   * Return the proper Client instance interface to handle request actions
   * @static
   * @param {*} chargingStation: instance of ChargingStation
   * @returns the ChargingStationClient instance for the proper OCPP protocol
   * @memberof ChargingStationClient
   */
  static async getChargingStationClient(chargingStation) {
    const JsonRestChargingStationClient = require('./json/JsonRestChargingStationClient');
    let chargingClient = null;
    // Check protocol
    switch (chargingStation.getOcppProtocol()) {
      // JSON
      case Constants.OCPP_PROTOCOL_JSON:
        // Get the client from JSon Server
        if (global.centralSystemJson) {
          chargingClient = global.centralSystemJson.getChargingStationClient(chargingStation.getTenantID(), chargingStation.getID());
        }
        // Not Found and deployed in Cloud Foundry?
        if (!chargingClient && Configuration.isCloudFoundry()) {
          // Use the remote client
          chargingClient = new JsonRestChargingStationClient(chargingStation);
        }
        break;
      // SOAP
      case Constants.OCPP_PROTOCOL_SOAP:
      default:
        // Get the Soap one by default
        const SoapChargingStationClient = require('./soap/SoapChargingStationClient');
        // Init client
        chargingClient = await new SoapChargingStationClient(chargingStation);
        break;
    }
    // Check
    if (!chargingClient) {
      throw new BackendError(chargingStation.getID(), "Client has not been found",
        "ChargingStationClient", "getChargingStationClient");
    }
    return chargingClient;
  }

  /**
   * Trigger a reset/reboot on a charging station
   *
   * @param {*} type
   * @memberof ChargingStationClient
   */
  reset(params) {
  }

  clearCache() {
  }

  getConfiguration(params) {
  }

  changeConfiguration(params) {
  }

  startTransaction(params) {
  }

  remoteStopTransaction(params) {
  }

  unlockConnector(params) {
  }

  setChargingProfile(params) {
  }

  getCompositeSchedule(params) {
  }

  genericOCPPCommand(commandName, params) {
  }

  /**
   * Default handling of OCPP command. It can be refine with some special methods in case of needs
   *
   * @param {*} commandName: OCPP command name
   * @param {*} params: OCPP parameters for the command
   * @returns
   * @memberof ChargingStationClient
   */
  sendCommand(commandName, params) {
    // Handle Requests
    switch (commandName) {
      // Reset
      case 'Reset':
        return this.reset(params);

      // Clear cache
      case 'ClearCache':
        return this.clearCache();

      // Get Configuration
      case 'GetConfiguration':
        return this.getConfiguration(params);

      // Set Configuration
      case 'ChangeConfiguration':
        // Change the config
        return this.changeConfiguration(params);

      // Unlock Connector
      case 'UnlockConnector':
        return this.unlockConnector(params);

      // Start Transaction
      case 'StartTransaction':
        return this.startTransaction(params);

      // Stop Transaction
      case 'StopTransaction':
        return this.stopTransaction(params);

      // Set Charging Profile
//      case 'SetChargingProfile':
//        return this.setChargingProfile(params);
      
      // Get Compoiste Schedule (power limits)
//      case 'GetCompositeSchedule':
//        return this.getCompositeSchedule(params);

      default:
      // In case we do not have a specific handling we try to load a generic command
        return this.genericOCPPCommand(commandName, params);

    }
  }
  
}

module.exports = ChargingStationClient;
