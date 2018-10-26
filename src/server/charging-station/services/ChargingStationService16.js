const ChargingStationService = require('./ChargingStationService');
const ChargingStation = require('../../../model/ChargingStation');
const Logging = require('../../../utils/Logging');
require('source-map-support').install();

/**
 * Implements basic functionnalities for OCPP 1.5 in regards to incoming request from Charge Box
 * @class CentralChargingStationService
 */
class ChargingStationService16 extends ChargingStationService {
  // Common constructor for Central System Service
  constructor(centralSystemConfig, chargingStationConfig) {
    super(centralSystemConfig, chargingStationConfig);
  }

  /**
   * On bootNotification from charge box
   * It should create a charging station if it does not exist
   * Otherwise it will update existing stations with bmessage information
   * 
   * @param {*} payload
   * @returns status, current time and heartbeatInterval in second
   * @memberof CentralChargingStationService
   */
  async handleBootNotification(payload) {
    try {
      // Set the endpoint
      payload.endpoint = payload.From.Address;
      // Set the ChargeBox ID
      payload.id = payload.chargeBoxIdentity;
      // Set the default Heart Beat
      payload.lastReboot = new Date();
      payload.lastHeartBeat = payload.lastReboot;
      payload.timestamp = payload.lastReboot;

      // Get the charging station
      let chargingStation = (payload.hasOwnProperty('tenant') ?
        await ChargingStation.getChargingStation(payload.chargeBoxIdentity, payload.tenant) :
        await ChargingStation.getChargingStation(payload.chargeBoxIdentity));
      if (!chargingStation) {
        // Save Charging Station
        chargingStation = new ChargingStation(payload);
        // Set the URL = enpoint
        chargingStation.setChargingStationURL(chargingStation.getEndPoint());
        // Update timestamp
        chargingStation.setCreatedOn(new Date());
        chargingStation.setLastHeartBeat(new Date());
      } else {
        // Set the URL = enpoint
        if (!chargingStation.getChargingStationURL()) {
          chargingStation.setChargingStationURL(chargingStation.getEndPoint())
        }
        // Update data
        chargingStation.setChargePointVendor(payload.chargePointVendor);
        chargingStation.setChargePointModel(payload.chargePointModel);
        chargingStation.setChargePointSerialNumber(payload.chargePointSerialNumber);
        chargingStation.setChargeBoxSerialNumber(payload.chargeBoxSerialNumber);
        chargingStation.setFirmwareVersion(payload.firmwareVersion);
        chargingStation.setOcppVersion(payload.ocppVersion);
        chargingStation.setLastHeartBeat(new Date());
        // Back again
        chargingStation.setDeleted(false);
      }
      // Save Charging Station
      const updatedChargingStation = await chargingStation.save();
      // Save the Boot Notification
      await updatedChargingStation.handleBootNotification(payload);
      // Return the result
      return {
        'currentTime': new Date().toISOString(),
        'status': 'Accepted',
        'heartbeatInterval': this._chargingStationConfig.heartbeatIntervalSecs
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('BootNotification', error);
      // Reject
      return {
        'status': 'Rejected',
        'currentTime': new Date().toISOString(),
        'heartbeatInterval': this._chargingStationConfig.heartbeatIntervalSecs
      };
    }
  }

  async handleHeartbeat(payload) {
    try {
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Save
      await chargingStation.handleHeartBeat();
      // Return			
      return {
        'currentTime': chargingStation.getLastHeartBeat().toISOString()
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('HeartBeat', error);
      // Send the response
      return {
        'currentTime': new Date().toISOString()
      };
    }
  }

  async handleStatusNotification(payload) {
    try {
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Handle
      await chargingStation.handleStatusNotification(payload);
      // Respond
      return {};
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('StatusNotification', error);
      // Return
      return {};
    }
  }

  async handleMeterValues(payload) {
    try {
      // Get the charging station
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Save
      await chargingStation.handleMeterValues(payload);
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('MeterValues', error);
      // Response
      return {};
    }
  }

  async handleAuthorize(payload) {
    try {
      // Get the charging station
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Handle
      await chargingStation.handleAuthorize(payload);
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('Authorize', error);
      // Return
      return {
        'status': 'Invalid'
      };
    }
  }

  async handleDiagnosticsStatusNotification(payload) {
    try {
      // Get the charging station
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Save
      await chargingStation.handleDiagnosticsStatusNotification(payload);
      // Return
      return {};
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('DiagnosticsStatusNotification', error);
      return {};
    }
  }

  async handleFirmwareStatusNotification(payload) {
    try {
      // Get the charging station
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Save
      await chargingStation.handleFirmwareStatusNotification(payload);
      // Return
      return {};
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage('FirmwareStatusNotification', error);
      return {};
    }
  }

  async handleStartTransaction(payload) {
    try {
      // Get the charging station
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Save
      const transaction = await chargingStation.handleStartTransaction(payload);
      // Return
      return {
        'transactionId': transaction.id,
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('StartTransaction', error);
      return {
        'transactionId': 0,
        'status': 'Invalid'
      };
    }
  }

  async handleDataTransfer(payload) {
    try {
      // Get the charging station
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Save
      await chargingStation.handleDataTransfer(payload);
      // Return
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('DataTransfer', error);
      return {
        'status': 'Rejected'
      };
    }
  }

  async handleStopTransaction(payload) {
    try {
      // Get the charging station
      const chargingStation = await this._checkAndGetChargingStation(payload.chargeBoxIdentity, payload.tenant);
      // Handle
      await chargingStation.handleStopTransaction(payload);
      // Success
      return {
        'status': 'Accepted'
      };
    } catch (error) {
      // Set the source
      error.source = payload.chargeBoxIdentity;
      // Log error
      Logging.logActionExceptionMessage('StopTransaction', error);
      // Error
      return {
        'status': 'Invalid'
      };
    }
  }
}

module.exports = ChargingStationService16;