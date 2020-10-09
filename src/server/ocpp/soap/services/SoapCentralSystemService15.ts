import { OCPPProtocol, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import global from '../../../../types/GlobalType';

const MODULE_NAME = 'SoapCentralSystemService15';

export default { /* Services */
  CentralSystemService: { /* Ports */
    CentralSystemServiceSoap12: { /* Methods */
      Authorize: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.AUTHORIZE, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleAuthorize(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.AUTHORIZE, {
            'result': result
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
          Logging.logException(error, ServerAction.AUTHORIZE, headers.chargeBoxIdentity,
            MODULE_NAME, 'Authorize', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'authorizeResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          });
        });
      },

      StartTransaction: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.START_TRANSACTION, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStartTransaction(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.START_TRANSACTION, {
            'result': result
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
          Logging.logException(error, ServerAction.START_TRANSACTION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StartTransaction', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
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

      StopTransaction: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STOP_TRANSACTION, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStopTransaction(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STOP_TRANSACTION, {
            'result': result
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
          Logging.logException(error, ServerAction.STOP_TRANSACTION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StopTransaction', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'stopTransactionResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          });
        });
      },

      Heartbeat: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add current IPs to charging station properties
          headers.currentIPAddress = Utils.getRequestIP(req);
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.HEARTBEAT, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleHeartbeat(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.HEARTBEAT, {
            'result': result
          });
          callback({
            'heartbeatResponse': {
              'currentTime': result.currentTime
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, ServerAction.HEARTBEAT, headers.chargeBoxIdentity,
            MODULE_NAME, 'Heartbeat', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'heartbeatResponse': {
              'currentTime': new Date().toISOString()
            }
          });
        });
      },

      MeterValues: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.METER_VALUES, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleMeterValues(headers, args);
          // Return the result async
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.METER_VALUES, {
            'result': result
          });
          callback({
            'meterValuesResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, ServerAction.METER_VALUES, headers.chargeBoxIdentity,
            MODULE_NAME, 'MeterValues', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'meterValuesResponse': {}
          });
        });
      },

      BootNotification: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add OCPP Version
          headers.ocppVersion = OCPPVersion.VERSION_15;
          headers.ocppProtocol = OCPPProtocol.SOAP;
          // Add current IPs to charging station properties
          headers.currentIPAddress = Utils.getRequestIP(req);
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.BOOT_NOTIFICATION, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleBootNotification(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.BOOT_NOTIFICATION, {
            'result': result
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
          Logging.logException(error, ServerAction.BOOT_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'BootNotification', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'bootNotificationResponse': {
              'status': 'Rejected',
              'currentTime': new Date().toISOString(),
              'heartbeatInterval': 60
            }
          });
        });
      },

      StatusNotification: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STATUS_NOTIFICATION, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStatusNotification(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STATUS_NOTIFICATION, {
            'result': result
          });
          callback({
            'statusNotificationResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, ServerAction.STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StatusNotification', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          // Default
          callback({
            'statusNotificationResponse': {}
          });
        });
      },

      FirmwareStatusNotification: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.FIRMWARE_STATUS_NOTIFICATION, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleFirmwareStatusNotification(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.FIRMWARE_STATUS_NOTIFICATION, {
            'result': result
          });
          callback({
            'firmwareStatusNotificationResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, ServerAction.FIRMWARE_STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'FirmwareStatusNotification', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'firmwareStatusNotificationResponse': {}
          });
        });
      },

      DiagnosticsStatusNotification: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleDiagnosticsStatusNotification(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, {
            'result': result
          });
          callback({
            'diagnosticsStatusNotificationResponse': {}
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'DiagnosticsStatusNotification', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'diagnosticsStatusNotificationResponse': {}
          });
        });
      },

      DataTransfer: function(args, callback, headers, req) {
        // Check SOAP params
        Utils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.CHARGING_STATION_DATA_TRANSFER, [ headers, args ]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleDataTransfer(headers, args);
          // Log
          Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.CHARGING_STATION_DATA_TRANSFER, {
            'result': result
          });
          callback({
            'dataTransferResponse': {
              'status': result.status
            }
          });
        }).catch((error) => {
          // Log
          Logging.logException(error, ServerAction.CHARGING_STATION_DATA_TRANSFER, headers.chargeBoxIdentity,
            MODULE_NAME, 'DataTransfer', (headers.tenantID ? headers.tenantID : Constants.DEFAULT_TENANT));
          callback({
            'dataTransferResponse': {
              'status': 'Rejected'
            }
          });
        });
      }
    }
  }
};
