import Logging from '../../../../utils/Logging';
import Utils from '../../../../utils/Utils';
import Constants from '../../../../utils/Constants';
import TSGlobal from '../../../../types/GlobalType';
let var global: TSGlobal;

const MODULE_NAME = "SoapCentralSystemService12";

export default { /* Services */
  CentralSystemService: { /* Ports */
    CentralSystemServiceSoap12: { /* Methods */
      Authorize: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Authorize", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleAuthorize(headers, args);
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

      StartTransaction: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StartTransaction", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleStartTransaction(headers, args);
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

      StopTransaction: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StopTransaction", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleStopTransaction(headers, args);
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
      },

      Heartbeat: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Heartbeat", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleHeartbeat(headers, args);
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
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "MeterValues", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleMeterValues(headers, args);
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

      BootNotification: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add OCPP Version
          headers.ocppVersion = Constants.OCPP_VERSION_12;
          headers.ocppProtocol = Constants.OCPP_PROTOCOL_SOAP;
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "BootNotification", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleBootNotification(headers, args);
          // Log
          Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "BootNotification", {
            "result": result
          });
          callback({
            'bootNotificationResponse': {
              'currentTime': result.currentTime,
              'status': result.status,
              'heartbeatInterval': result.heartbeatInterval
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
              'heartbeatInterval': 60
            }
          });
        });
      },

      StatusNotification: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StatusNotification", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleStatusNotification(headers, args);
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

      FirmwareStatusNotification: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "FirmwareStatusNotification", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleFirmwareStatusNotification(headers, args);
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

      DiagnosticsStatusNotification: function (args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", args);
          // Handle
          const result = await global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleDiagnosticsStatusNotification(headers, args);
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
      }
    }
  }
};
