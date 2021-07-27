import { OCPPProtocol, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import OCPPUtils from '../../utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import global from '../../../../types/GlobalType';

const MODULE_NAME = Constants.MODULE_SOAP_OCPP_SERVER_15;

export default { /* Services */
  CentralSystemService: { /* Ports */
    CentralSystemServiceSoap12: { /* Methods */
      Authorize: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.AUTHORIZE, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleAuthorize(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.AUTHORIZE, {
            'result': result
          });
          // Answer
          callback({
            'authorizeResponse': {
              'idTagInfo': {
                'status': result.idTagInfo.status
              }
            }
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.AUTHORIZE, headers.chargeBoxIdentity,
            MODULE_NAME, 'Authorize', headers.tenantID ?? Constants.DEFAULT_TENANT);
          callback({
            'authorizeResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          });
        });
      },

      StartTransaction: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.START_TRANSACTION, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStartTransaction(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.START_TRANSACTION, {
            'result': result
          });
          callback({
            'startTransactionResponse': {
              'transactionId': result.transactionId,
              'idTagInfo': {
                'status': result.idTagInfo.status
              }
            }
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.START_TRANSACTION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StartTransaction', headers.tenantID ?? Constants.DEFAULT_TENANT);
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

      StopTransaction: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STOP_TRANSACTION, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStopTransaction(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STOP_TRANSACTION, {
            'result': result
          });
          callback({
            'stopTransactionResponse': {
              'idTagInfo': {
                'status': result.idTagInfo.status
              }
            }
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.STOP_TRANSACTION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StopTransaction', headers.tenantID ?? Constants.DEFAULT_TENANT);
          callback({
            'stopTransactionResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          });
        });
      },

      Heartbeat: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add current IPs to charging station properties
          headers.currentIPAddress = Utils.getRequestIP(req);
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.HEARTBEAT, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleHeartbeat(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.HEARTBEAT, {
            'result': result
          });
          callback({
            'heartbeatResponse': {
              'currentTime': result.currentTime
            }
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.HEARTBEAT, headers.chargeBoxIdentity,
            MODULE_NAME, 'Heartbeat', headers.tenantID ?? Constants.DEFAULT_TENANT);
          callback({
            'heartbeatResponse': {
              'currentTime': new Date().toISOString()
            }
          });
        });
      },

      MeterValues: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.METER_VALUES, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleMeterValues(headers, args);
          // Return the result async
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.METER_VALUES, {
            'result': result
          });
          callback({
            'meterValuesResponse': {}
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.METER_VALUES, headers.chargeBoxIdentity,
            MODULE_NAME, 'MeterValues', headers.tenantID ?? Constants.DEFAULT_TENANT);
          callback({
            'meterValuesResponse': {}
          });
        });
      },

      BootNotification: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add OCPP Version
          headers.ocppVersion = OCPPVersion.VERSION_15;
          headers.ocppProtocol = OCPPProtocol.SOAP;
          // Add current IPs to charging station properties
          headers.currentIPAddress = Utils.getRequestIP(req);
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.BOOT_NOTIFICATION, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleBootNotification(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.BOOT_NOTIFICATION, {
            'result': result
          });
          callback({
            'bootNotificationResponse': {
              'currentTime': result.currentTime,
              'status': result.status,
              'heartbeatInterval': result.interval
            }
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.BOOT_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'BootNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          callback({
            'bootNotificationResponse': {
              'status': 'Rejected',
              'currentTime': new Date().toISOString(),
              'heartbeatInterval': Constants.BOOT_NOTIFICATION_WAIT_TIME
            }
          });
        });
      },

      StatusNotification: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STATUS_NOTIFICATION, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStatusNotification(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.STATUS_NOTIFICATION, {
            'result': result
          });
          callback({
            'statusNotificationResponse': {}
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Default
          callback({
            'statusNotificationResponse': {}
          });
        });
      },

      FirmwareStatusNotification: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.FIRMWARE_STATUS_NOTIFICATION, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleFirmwareStatusNotification(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.FIRMWARE_STATUS_NOTIFICATION, {
            'result': result
          });
          callback({
            'firmwareStatusNotificationResponse': {}
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.FIRMWARE_STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'FirmwareStatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          callback({
            'firmwareStatusNotificationResponse': {}
          });
        });
      },

      DiagnosticsStatusNotification: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleDiagnosticsStatusNotification(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, {
            'result': result
          });
          callback({
            'diagnosticsStatusNotificationResponse': {}
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.DIAGNOSTICS_STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'DiagnosticsStatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          callback({
            'diagnosticsStatusNotificationResponse': {}
          });
        });
      },

      DataTransfer: function(args, callback, headers, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Log
          await Logging.logChargingStationServerReceiveAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.CHARGING_STATION_DATA_TRANSFER, [headers, args]);
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleDataTransfer(headers, args);
          // Log
          await Logging.logChargingStationServerRespondAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, ServerAction.CHARGING_STATION_DATA_TRANSFER, {
            'result': result
          });
          callback({
            'dataTransferResponse': {
              'status': result.status
            }
          });
        }).catch(async (error) => {
          // Log
          await Logging.logException(error, ServerAction.CHARGING_STATION_DATA_TRANSFER, headers.chargeBoxIdentity,
            MODULE_NAME, 'DataTransfer', headers.tenantID ?? Constants.DEFAULT_TENANT);
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
