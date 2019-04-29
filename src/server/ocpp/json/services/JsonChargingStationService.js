const Logging = require('../../../../utils/Logging');
const Constants = require('../../../../utils/Constants');
const Configuration = require('../../../../utils/Configuration');

const MODULE_NAME = "JsonChargingStationService";

class JsonChargingStationService {
  constructor(chargingStationConfig) {
    this._chargingStationConfig = chargingStationConfig;
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16);
  }

  async _handle(command, headers, payload) {
    try {
      // Handle
      return await this.chargingStationService["handle" + command](headers, payload);
    } catch (error) {
      // Log
      Logging.logException(error, command, headers.tenantID, headers.chargeBoxIdentity, MODULE_NAME, command);
      // Rethrow
      throw error;
    }
  }

  async handleBootNotification(headers, payload) {
    // Override URL
    payload.chargingStationURL = Configuration.getJsonEndpointConfig().baseUrl;
    // Forward
    const result = await this._handle("BootNotification", headers, payload);
    // Return the response
    return {
      'currentTime': result.currentTime,
      'status': result.status,
      'interval': result.heartbeatInterval
    };
  }

  async handleHeartbeat(headers, payload) {
    // Forward
    const result = await this._handle("Heartbeat", headers, payload);
    // Return the response
    return {
      'currentTime': result.currentTime
    };
  }

  async handleStatusNotification(headers, payload) {
    // Forward
    await this._handle("StatusNotification", headers, payload);
    // Return the response
    return {};
  }

  async handleMeterValues(headers, payload) {
    // Forward
    await this._handle("MeterValues", headers, payload);
    // Return the response
    return {};
  }

  async handleAuthorize(headers, payload) {
    // Forward
    const result = await this._handle("Authorize", headers, payload);
    // Return the response
    return {
      'idTagInfo': {
        'status': result.status
      }
    };
  }

  async handleDiagnosticsStatusNotification(headers, payload) {
    // Forward
    await this._handle("DiagnosticsStatusNotification", headers, payload);
    // Return the response
    return {};
  }

  async handleFirmwareStatusNotification(headers, payload) {
    // Forward
    await this._handle("FirmwareStatusNotification", headers, payload);
    // Return the response
    return {};
  }

  async handleStartTransaction(headers, payload) {
    // Forward
    const result = await this._handle("StartTransaction", headers, payload);
    // Return the response
    return {
      'transactionId': result.transactionId,
      'idTagInfo': {
        'status': result.status
      }
    };
  }

  async handleDataTransfer(headers, payload) {
    // Forward
    const result = await this._handle("DataTransfer", headers, payload);
    // Return the response
    return {
      'status': result.status
    };
  }

  async handleStopTransaction(headers, payload) {
    // Forward
    const result = await this._handle("StopTransaction", headers, payload);
    // Return the response
    return {
      'idTagInfo': {
        'status': result.status
      }
    };
  }
}

module.exports = JsonChargingStationService;
