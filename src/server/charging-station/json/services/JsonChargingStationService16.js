const Logging = require('../../../../utils/Logging');
const Constants = require('../../../../utils/Constants');
const OCPPError = require('../../../../exception/OcppError');

const MODULE_NAME = "JsonChargingStationService16";

class JsonChargingStationService16 {
  constructor(chargingStationConfig) {
    this._chargingStationConfig = chargingStationConfig;
    // Get the OCPP service
    this.chargingStationService = global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16);
  }

  async handleBootNotification(payload) {
    try {
      // Add OCPP Version
      headers.ocppVersion = Constants.OCPP_VERSION_16;
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "BootNotification", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleBootNotification(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "BootNotification", {
          "result": result
        });
        return {
          'currentTime': result.currentTime,
          'status': result.status,
          'heartbeatInterval': result.heartbeatInterval
        };
      });
    } catch (error) {
      // Log
      Logging.logException(error, "BootNotification", payload.chargeBoxIdentity, MODULE_NAME, "BootNotification", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleHeartbeat(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "Heartbeat", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleHeartbeat(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "Heartbeat", {
          "result": result
        });
        return {
          'currentTime': result.currentTime
        };
      });
    } catch (error) {
      // Log
      Logging.logException(error, "Heartbeat", payload.chargeBoxIdentity, MODULE_NAME, "Heartbeat", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleStatusNotification(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "StatusNotification", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleStatusNotification(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "StatusNotification", {
          "result": result
        });
        return {};
      });
    } catch (error) {
      // Log
      Logging.logException(error, "StatusNotification", payload.chargeBoxIdentity, MODULE_NAME, "StatusNotification", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleMeterValues(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "MeterValues", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleMeterValues(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "MeterValues", {
          "result": result
        });
        return {};
      });
    } catch (error) {
      // Log
      Logging.logException(error, "MeterValues", payload.chargeBoxIdentity, MODULE_NAME, "MeterValues", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleAuthorize(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "Authorize", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleAuthorize(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "Authorize", {
          "result": result
        });
        return {
          'idTagInfo': {
            'status': result.status
          }
        };
      });
    } catch (error) {
      // Log
      Logging.logException(error, "Authorize", payload.chargeBoxIdentity, MODULE_NAME, "Authorize", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleDiagnosticsStatusNotification(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "DiagnosticsStatusNotification", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleDiagnosticsStatusNotification(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "DiagnosticsStatusNotification", {
          "result": result
        });
        return {};
      });
    } catch (error) {
      // Log
      Logging.logException(error, "DiagnosticsStatusNotification", payload.chargeBoxIdentity, MODULE_NAME, "DiagnosticsStatusNotification", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleFirmwareStatusNotification(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "FirmwareStatusNotification", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleFirmwareStatusNotification(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "FirmwareStatusNotification", {
          "result": result
        });
        return {};
      });
    } catch (error) {
      // Log
      Logging.logException(error, "FirmwareStatusNotification", payload.chargeBoxIdentity, MODULE_NAME, "FirmwareStatusNotification", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleStartTransaction(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "StartTransaction", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleStartTransaction(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "StartTransaction", {
          "result": result
        });
        return {
          'transactionId': result.transactionId,
          'idTagInfo': {
            'status': result.status
          }
        };
      });
    } catch (error) {
      // Log
      Logging.logException(error, "StartTransaction", payload.chargeBoxIdentity, MODULE_NAME, "StartTransaction", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleDataTransfer(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "DataTransfer", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleDataTransfer(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "DataTransfer", {
          "result": result
        });
        return {
          'status': result.status
        };
      });
    } catch (error) {
      // Log
      Logging.logException(error, "DataTransfer", payload.chargeBoxIdentity, MODULE_NAME, "DataTransfer", payload.tenantID);
      // Rethrow
      throw error;
    }
  }

  async handleStopTransaction(payload) {
    try {
      // Log
      Logging.logReceivedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "StopTransaction", payload);
      // Handle
      global.centralSystemJson.getChargingStationService(Constants.OCPP_VERSION_16).handleStopTransaction(payload).then(function (result) {
        // Log
        Logging.logReturnedAction(MODULE_NAME, payload.tenantID, payload.chargeBoxIdentity, "StopTransaction", {
          "result": result
        });
        return {
          'idTagInfo': {
            'status': result.status
          }
        };
      });
    } catch (error) {
      // Log
      Logging.logException(error, "StopTransaction", payload.chargeBoxIdentity, MODULE_NAME, "StopTransaction", payload.tenantID);
      // Rethrow
      throw error;
    }
  }
}

module.exports = JsonChargingStationService16;