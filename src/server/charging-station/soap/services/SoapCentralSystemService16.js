const Logging = require('../../../../utils/Logging');
const Utils = require('../../../../utils/Utils');
const Constants = require('../../../../utils/Constants');

const MODULE_NAME = "SoapCentralSystemService16";

module.exports = { /* Services */
  CentralSystemService: { /* Ports */
    CentralSystemServiceSoap12: { /* Methods */
      Authorize: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Authorize", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleAuthorize(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Authorize", {
            "result": result
          });
          // Answer
          callback({
            'authorizeResponse': {
              'idTagInfo': {
                'status': result.status
              }
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "Authorize", headers.chargeBoxIdentity, 
            MODULE_NAME, "Authorize", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'authorizeResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          });
        });
      },

      BootNotification: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add OCPP Version
          headers.ocppVersion = Constants.OCPP_VERSION_16;
          headers.ocppProtocol = Constants.OCPP_PROTOCOL_SOAP;
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "BootNotification", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleBootNotification(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "BootNotification", {
            "result": result
          });
          callback({
            'bootNotificationResponse': {
              'currentTime': result.currentTime,
              'status': result.status,
              'interval': result.heartbeatInterval
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "BootNotification", headers.chargeBoxIdentity, 
            MODULE_NAME, "BootNotification", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'bootNotificationResponse': {
              'status': 'Rejected',
              'currentTime': new Date().toISOString(),
              'interval': 60
            }
          });
        });
      },

      DataTransfer: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DataTransfer", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleDataTransfer(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DataTransfer", {
            "result": result
          });
          callback({
            'dataTransferResponse': {
              'status': result.status
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "DataTransfer", headers.chargeBoxIdentity, 
            MODULE_NAME, "DataTransfer", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'dataTransferResponse': {
              'status': 'Rejected'
            }
          });
        });
      },

      DiagnosticsStatusNotification: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleDiagnosticsStatusNotification(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", {
            "result": result
          });
          callback({
            'diagnosticsStatusNotificationResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "DiagnosticsStatusNotification", headers.chargeBoxIdentity, 
            MODULE_NAME, "DiagnosticsStatusNotification", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'diagnosticsStatusNotificationResponse': {}
          });
        });
      },

      FirmwareStatusNotification: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "FirmwareStatusNotification", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleFirmwareStatusNotification(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "FirmwareStatusNotification", {
            "result": result
          });
          callback({
            'firmwareStatusNotificationResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "FirmwareStatusNotification", headers.chargeBoxIdentity, 
            MODULE_NAME, "FirmwareStatusNotification", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'firmwareStatusNotificationResponse': {}
          });
        });
      },

      Heartbeat: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = headers;
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Heartbeat", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleHeartbeat(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Heartbeat", {
            "result": result
          });
          callback({
            'heartbeatResponse': {
              'currentTime': result.currentTime
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "Heartbeat", headers.chargeBoxIdentity, 
            MODULE_NAME, "Heartbeat", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'heartbeatResponse': {
              'currentTime': new Date().toISOString()
            }
          });
        });
      },

      MeterValues: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "MeterValues", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleMeterValues(payload);
          // Return the result async
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "MeterValues", {
            "result": result
          });
          callback({
            'meterValuesResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "MeterValues", headers.chargeBoxIdentity, 
            MODULE_NAME, "MeterValues", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'meterValuesResponse': {}
          });
        });
      },

      StartTransaction: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StartTransaction", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleStartTransaction(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StartTransaction", {
            "result": result
          });
          callback({
            'startTransactionResponse': {
              'transactionId': result.transactionId,
              'idTagInfo': {
                'status': result.status
              }
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "StartTransaction", headers.chargeBoxIdentity, 
            MODULE_NAME, "StartTransaction", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'startTransactionResponse': {
              'transactionId': 0,
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          });
        });
      },

      StatusNotification: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StatusNotification", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleStatusNotification(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StatusNotification", {
            "result": result
          });
          callback({
            'statusNotificationResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "StatusNotification", headers.chargeBoxIdentity, 
            MODULE_NAME, "StatusNotification", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          // Default
          callback({
            'statusNotificationResponse': {}
          });
        });
      },
      
      StopTransaction: function (args, callback, headers, req) {
        // Normalize Header
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StopTransaction", payload);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleStopTransaction(payload);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StopTransaction", {
            "result": result
          });
          callback({
            'stopTransactionResponse': {
              'idTagInfo': {
                'status': result.status
              }
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, "StopTransaction", headers.chargeBoxIdentity, 
            MODULE_NAME, "StopTransaction", (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'stopTransactionResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          });
        });
      }
    }
  }
};