import { OCPPProtocol, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { OCPPHeader } from '../../../../types/ocpp/OCPPHeader';
import OCPPUtils from '../../utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import global from '../../../../types/GlobalType';

const MODULE_NAME = Constants.MODULE_SOAP_OCPP_SERVER_16;

export default { /* Services */
  CentralSystemService: { /* Ports */
    CentralSystemServiceSoap12: { /* Methods */
      Authorize: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_AUTHORIZE, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleAuthorize(headers, args);
          const response = {
            'authorizeResponse': {
              'idTagInfo': {
                'status': result.idTagInfo.status
              }
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_AUTHORIZE, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'authorizeResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_AUTHORIZE, headers.chargeBoxIdentity,
            MODULE_NAME, 'Authorize', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_AUTHORIZE, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      BootNotification: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add current IP to charging station properties
          headers.currentIPAddress = Utils.getRequestIP(req);
          // Add OCPP Version
          headers.ocppVersion = OCPPVersion.VERSION_16;
          headers.ocppProtocol = OCPPProtocol.SOAP;
          // Add current IPs to charging station properties
          headers.currentIPAddress = Utils.getRequestIP(req);
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_BOOT_NOTIFICATION, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleBootNotification(headers, args);
          const response = {
            'bootNotificationResponse': {
              'currentTime': result.currentTime,
              'status': result.status,
              'interval': result.interval
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_BOOT_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'bootNotificationResponse': {
              'status': 'Rejected',
              'currentTime': new Date().toISOString(),
              'interval': Constants.BOOT_NOTIFICATION_WAIT_TIME
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_BOOT_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'BootNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_BOOT_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      DataTransfer: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.CHARGING_STATION_DATA_TRANSFER, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleDataTransfer(headers, args);
          const response = {
            'dataTransferResponse': {
              'status': result.status
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.CHARGING_STATION_DATA_TRANSFER, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'dataTransferResponse': {
              'status': 'Rejected'
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.CHARGING_STATION_DATA_TRANSFER, headers.chargeBoxIdentity,
            MODULE_NAME, 'DataTransfer', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.CHARGING_STATION_DATA_TRANSFER, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      DiagnosticsStatusNotification: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleDiagnosticsStatusNotification(headers, args);
          const response = {
            'diagnosticsStatusNotificationResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'diagnosticsStatusNotificationResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'DiagnosticsStatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      FirmwareStatusNotification: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleFirmwareStatusNotification(headers, args);
          const response = {
            'firmwareStatusNotificationResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'firmwareStatusNotificationResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'FirmwareStatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      Heartbeat: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Add current IPs to charging station properties
          headers.currentIPAddress = Utils.getRequestIP(req);
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_HEARTBEAT, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleHeartbeat(headers, args);
          const response = {
            'heartbeatResponse': {
              'currentTime': result.currentTime
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_HEARTBEAT, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'heartbeatResponse': {
              'currentTime': new Date().toISOString()
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_HEARTBEAT, headers.chargeBoxIdentity,
            MODULE_NAME, 'Heartbeat', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_HEARTBEAT, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      MeterValues: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_METER_VALUES, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleMeterValues(headers, args);
          const response = {
            'meterValuesResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_METER_VALUES, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'meterValuesResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_METER_VALUES, headers.chargeBoxIdentity,
            MODULE_NAME, 'MeterValues', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_METER_VALUES, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      StartTransaction: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_START_TRANSACTION, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleStartTransaction(headers, args);
          const response = {
            'startTransactionResponse': {
              'transactionId': result.transactionId,
              'idTagInfo': {
                'status': result.idTagInfo.status
              }
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_START_TRANSACTION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'startTransactionResponse': {
              'transactionId': 0,
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_START_TRANSACTION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StartTransaction', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_START_TRANSACTION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      StatusNotification: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_STATUS_NOTIFICATION, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleStatusNotification(headers, args);
          const response = {
            'statusNotificationResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STATUS_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'statusNotificationResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_STATUS_NOTIFICATION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STATUS_NOTIFICATION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      },

      StopTransaction: function(args, callback, headers: OCPPHeader, req): void {
        // Check SOAP params
        OCPPUtils.normalizeAndCheckSOAPParams(headers, req).then(async () => {
          // Trace
          const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity,
            ServerAction.OCPP_STOP_TRANSACTION, [headers, args], '>>', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_16).handleStopTransaction(headers, args);
          const response = {
            'stopTransactionResponse': {
              'idTagInfo': {
                'status': result.idTagInfo.status
              }
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STOP_TRANSACTION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, startTimestamp
          );
        }).catch(async (error) => {
          const response = {
            'stopTransactionResponse': {
              'idTagInfo': {
                'status': 'Invalid'
              }
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_STOP_TRANSACTION, headers.chargeBoxIdentity,
            MODULE_NAME, 'StopTransaction', headers.tenantID ?? Constants.DEFAULT_TENANT);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STOP_TRANSACTION, [headers, args], response, '<<', {
              siteID: headers.siteID,
              siteAreaID: headers.siteAreaID,
              companyID: headers.companyID,
            }, 0
          );
        });
      }
    }
  }
};
