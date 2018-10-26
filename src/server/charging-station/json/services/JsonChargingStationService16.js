const Logging = require('../../../../utils/Logging');
const Constants = require('../../../../utils/Constants');

const MODULE_NAME = "JsonChargingStationService16";

class JsonChargingStationService16 {
  constructor(chargingStationConfig) {
    this._chargingStationConfig = chargingStationConfig;
    // Get the OCPP service
    this.chargingStationService = global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16);
  }

  async _handle(command, payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.chargeBoxIdentity, command, payload);
      // Get the service
      const chargingStationService = global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16)
      // Handle
      const result = await chargingStationService["handle" + command](payload);
      // Log
      Logging.logReturnedAction(MODULE_NAME, payload.chargeBoxIdentity, command, {
        "result": result
      });
      // Return
      return result;
    } catch (error) {
      // Log
      Logging.logException(error, command, payload.chargeBoxIdentity, MODULE_NAME, command);
      // Rethrow
      throw error;
    }
  }

  async handleBootNotification(payload) {
    // Forward
    const result = await this._handle("BootNotification", payload);
    // Return the response
    return {
      'currentTime': result.currentTime,
      'status': result.status,
      'heartbeatInterval': result.heartbeatInterval
    };
  }

  async handleHeartbeat(payload) {
    // Forward
    const result = await this._handle("Heartbeat", payload);
    // Return the response
    return {
      'currentTime': result.currentTime
    };
  }

  async handleStatusNotification(payload) {
    // Forward
    const result = await this._handle("StatusNotification", payload);
    // Return the response
    return {};
  }

  async handleMeterValues(payload) {
    // Forward
    const result = await this._handle("MeterValues", payload);
    // Return the response
    return {};
  }

  async handleAuthorize(payload) {
    // Forward
    const result = await this._handle("Authorize", payload);
    // Return the response
    return {
      'idTagInfo': {
        'status': result.status
      }
    };
  }

  async handleDiagnosticsStatusNotification(payload) {
    // Forward
    const result = await this._handle("DiagnosticsStatusNotification", payload);
    // Return the response
    return {};
  }

  async handleFirmwareStatusNotification(payload) {
    // Forward
    const result = await this._handle("FirmwareStatusNotification", payload);
    // Return the response
    return {};
  }

  async handleStartTransaction(payload) {
    // Forward
    const result = await this._handle("StartTransaction", payload);
    // Return the response
    return {
      'transactionId': result.transactionId,
      'idTagInfo': {
        'status': result.status
      }
    };
  }

  async handleDataTransfer(payload) {
    // Forward
    const result = await this._handle("DataTransfer", payload);
    // Return the response
    return {
      'status': result.status
    };
  }

  async handleStopTransaction(payload) {
    // Forward
    const result = await this._handle("StopTransaction", payload);
    // Return the response
    return {
      'status': result.status
    };
  }
}

module.exports = JsonChargingStationService16;