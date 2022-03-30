import { OCPPProtocol, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import { Command } from '../../../../types/ChargingStation';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { OCPPHeader } from '../../../../types/ocpp/OCPPHeader';
import OCPPUtils from '../../utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import global from '../../../../types/GlobalType';

const MODULE_NAME = Constants.MODULE_SOAP_OCPP_SERVER_15;

export default { /* Services */
  CentralSystemService: { /* Ports */
    CentralSystemServiceSoap12: { /* Methods */
      Authorize: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.AUTHORIZE, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_AUTHORIZE, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleAuthorize(headers, args);
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
            ServerAction.OCPP_AUTHORIZE, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
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
          await Logging.logException(error, ServerAction.OCPP_AUTHORIZE,
            MODULE_NAME, 'Authorize', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_AUTHORIZE, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      StartTransaction: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.START_TRANSACTION, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_START_TRANSACTION, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStartTransaction(headers, args);
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
            ServerAction.OCPP_START_TRANSACTION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
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
          await Logging.logException(error, ServerAction.OCPP_START_TRANSACTION,
            MODULE_NAME, 'StartTransaction', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_START_TRANSACTION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      StopTransaction: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.STOP_TRANSACTION, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STOP_TRANSACTION, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStopTransaction(headers, args);
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
            ServerAction.OCPP_STOP_TRANSACTION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
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
          await Logging.logException(error, ServerAction.OCPP_STOP_TRANSACTION,
            MODULE_NAME, 'StopTransaction', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STOP_TRANSACTION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      Heartbeat: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.HEARTBEAT, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_HEARTBEAT, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleHeartbeat(headers, args);
          const response = {
            'heartbeatResponse': {
              'currentTime': result.currentTime
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_HEARTBEAT, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
          );
        }).catch(async (error) => {
          const response = {
            'heartbeatResponse': {
              'currentTime': new Date().toISOString()
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_HEARTBEAT,
            MODULE_NAME, 'Heartbeat', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_HEARTBEAT, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      MeterValues: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.METER_VALUES, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_METER_VALUES, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleMeterValues(headers, args);
          const response = {
            'meterValuesResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_METER_VALUES, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
          );
        }).catch(async (error) => {
          const response = {
            'meterValuesResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_METER_VALUES,
            MODULE_NAME, 'MeterValues', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_METER_VALUES, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      BootNotification: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Add OCPP Version
        headers.ocppVersion = OCPPVersion.VERSION_15;
        headers.ocppProtocol = OCPPProtocol.SOAP;
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.BOOT_NOTIFICATION, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_BOOT_NOTIFICATION, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleBootNotification(headers, args);
          const response = {
            'bootNotificationResponse': {
              'currentTime': result.currentTime,
              'status': result.status,
              'heartbeatInterval': result.interval
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_BOOT_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
          );
        }).catch(async (error) => {
          const response = {
            'bootNotificationResponse': {
              'status': 'Rejected',
              'currentTime': new Date().toISOString(),
              'heartbeatInterval': Constants.BOOT_NOTIFICATION_WAIT_TIME
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_BOOT_NOTIFICATION,
            MODULE_NAME, 'BootNotification', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_BOOT_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      StatusNotification: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.STATUS_NOTIFICATION, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STATUS_NOTIFICATION, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleStatusNotification(headers, args);
          const response = {
            'statusNotificationResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STATUS_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
          );
        }).catch(async (error) => {
          const response = {
            'statusNotificationResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_STATUS_NOTIFICATION,
            MODULE_NAME, 'StatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_STATUS_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      FirmwareStatusNotification: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.FIRMWARE_STATUS_NOTIFICATION, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleFirmwareStatusNotification(headers, args);
          const response = {
            'firmwareStatusNotificationResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
          );
        }).catch(async (error) => {
          const response = {
            'firmwareStatusNotificationResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION,
            MODULE_NAME, 'FirmwareStatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_FIRMWARE_STATUS_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      DiagnosticsStatusNotification: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.DIAGNOSTICS_STATUS_NOTIFICATION, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleDiagnosticsStatusNotification(headers, args);
          const response = {
            'diagnosticsStatusNotificationResponse': {}
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
          );
        }).catch(async (error) => {
          const response = {
            'diagnosticsStatusNotificationResponse': {}
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION,
            MODULE_NAME, 'DiagnosticsStatusNotification', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.OCPP_DIAGNOSTICS_STATUS_NOTIFICATION, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      },

      DataTransfer: function(args, callback, headers: OCPPHeader, req): void {
        const request = { ...headers, ...args };
        // Check SOAP params
        OCPPUtils.checkChargingStationAndEnrichSoapOcppHeaders(Command.DATA_TRANSFER, headers, req).then(async () => {
          // Trace
          const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.CHARGING_STATION_DATA_TRANSFER, request, '>>',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
          // Handle
          const result = await global.centralSystemSoapServer.getChargingStationService(OCPPVersion.VERSION_15).handleDataTransfer(headers, args);
          const response = {
            'dataTransferResponse': {
              'status': result.status
            }
          };
          callback(response);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.CHARGING_STATION_DATA_TRANSFER, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID },
            performanceTracingData
          );
        }).catch(async (error) => {
          const response = {
            'dataTransferResponse': {
              'status': 'Rejected'
            }
          };
          callback(response);
          // Log
          await Logging.logException(error, ServerAction.CHARGING_STATION_DATA_TRANSFER,
            MODULE_NAME, 'DataTransfer', headers.tenantID ?? Constants.DEFAULT_TENANT_ID);
          // Trace
          await Logging.traceOcppMessageResponse(MODULE_NAME, headers.tenant, headers.chargeBoxIdentity,
            ServerAction.CHARGING_STATION_DATA_TRANSFER, request, response, '<<',
            { siteID: headers.siteID, siteAreaID: headers.siteAreaID, companyID: headers.companyID }
          );
        });
      }
    }
  }
};
