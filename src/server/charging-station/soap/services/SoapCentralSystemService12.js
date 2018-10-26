const Logging = require('../../../../utils/Logging');
const Utils = require('../../../../utils/Utils');
const Constants = require('../../../../utils/Constants');

const MODULE_NAME = "SoapCentralSystemService12";

module.exports = { /* Services */
  CentralSystemService: { /* Ports */
    CentralSystemServiceSoap12: { /* Methods */
      Authorize: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Authorize", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleAuthorize(payload).then(function (result) {
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
          });
        } catch (error) {
          // Log
          Logging.logException(error, "Authorize", headers.chargeBoxIdentity, MODULE_NAME, "Authorize", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 idTag of type s:string
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 idTagInfo of type  {
        								 status of type AuthorizationStatus|s:string|Accepted,Blocked,Expired,Invalid,ConcurrentTx
        								 expiryDate of type s:dateTime
        								 parentIdTag of type s:string
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2010/08/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      StartTransaction: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StartTransaction", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleStartTransaction(payload).then(function (result) {
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
          });
        } catch (error) {
          // Log
          Logging.logException(error, "StartTransaction", headers.chargeBoxIdentity, MODULE_NAME, "StartTransaction", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 connectorId of type s:int
        				 idTag of type s:string
        				 timestamp of type s:dateTime
        				 meterStart of type s:int
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 transactionId of type s:int
        				 idTagInfo of type  {
        								 status of type AuthorizationStatus|s:string|Accepted,Blocked,Expired,Invalid,ConcurrentTx
        								 expiryDate of type s:dateTime
        								 parentIdTag of type s:string
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2010/08/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      StopTransaction: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StopTransaction", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleStopTransaction(payload).then(function (result) {
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
          });
        } catch (error) {
          // Log
          Logging.logException(error, "StopTransaction", headers.chargeBoxIdentity, MODULE_NAME, "StopTransaction", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 transactionId of type s:int
        				 idTag of type s:string
        				 timestamp of type s:dateTime
        				 meterStop of type s:int
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 idTagInfo of type  {
        								 status of type AuthorizationStatus|s:string|Accepted,Blocked,Expired,Invalid,ConcurrentTx
        								 expiryDate of type s:dateTime
        								 parentIdTag of type s:string
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2010/08/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      Heartbeat: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = headers;
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Heartbeat", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleHeartbeat(payload).then(function (result) {
            // Log
            Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "Heartbeat", {
              "result": result
            });
            callback({
              'heartbeatResponse': {
                'currentTime': result.currentTime
              }
            });
          });
        } catch (error) {
          // Log
          Logging.logException(error, "Heartbeat", headers.chargeBoxIdentity, MODULE_NAME, "Heartbeat", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 currentTime of type s:dateTime
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      MeterValues: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "MeterValues", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleMeterValues(payload).then(function (result) {
            // Return the result async
            Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "MeterValues", {
              "result": result
            });
            callback({
              'meterValuesResponse': {}
            });
          });
        } catch (error) {
          // Log
          Logging.logException(error, "MeterValues", headers.chargeBoxIdentity, MODULE_NAME, "MeterValues", headers.tenantID);
          // Rethrow
          throw error;
        }


        /*
        	args = {
        				 connectorId of type s:int
        				 values[] of type  {
        								 timestamp of type s:dateTime
        								 value of type s:int
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2010/08/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      BootNotification: function (args, callback, headers, req) {
        try {
          // Add OCPP Version
          headers.ocppVersion = Constants.OCPP_VERSION_12;
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "BootNotification", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleBootNotification(payload).then(function (result) {
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
          });
        } catch (error) {
          // Log
          Logging.logException(error, "BootNotification", headers.chargeBoxIdentity, MODULE_NAME, "BootNotification", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 chargePointVendor of type s:string
        				 chargePointModel of type s:string
        				 chargePointSerialNumber of type s:string
        				 chargeBoxSerialNumber of type s:string
        				 firmwareVersion of type s:string
        				 iccid of type s:string
        				 imsi of type s:string
        				 meterType of type s:string
        				 meterSerialNumber of type s:string
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */

        /* return {
        				 status of type RegistrationStatus|s:string|Accepted,Rejected
        				 currentTime of type s:dateTime
        				 heartbeatInterval of type s:int
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      StatusNotification: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StatusNotification", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleStatusNotification(payload).then(function (result) {
            // Log
            Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "StatusNotification", {
              "result": result
            });
            callback({
              'statusNotificationResponse': {}
            });
          });
        } catch (error) {
          // Log
          Logging.logException(error, "StatusNotification", headers.chargeBoxIdentity, MODULE_NAME, "StatusNotification", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 connectorId of type s:int
        				 status of type ChargePointStatus|s:string|Available,Occupied,Faulted,Unavailable
        				 errorCode of type ChargePointErrorCode|s:string|ConnectorLockFailure,HighTemperature,Mode3Error,NoError,PowerMeterFailure,PowerSwitchFailure,ReaderFailure,ResetFailure
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      FirmwareStatusNotification: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "FirmwareStatusNotification", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleFirmwareStatusNotification(payload).then(function (result) {
            // Log
            Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "FirmwareStatusNotification", {
              "result": result
            });
            callback({
              'firmwareStatusNotificationResponse': {}
            });
          });
        } catch (error) {
          // Log
          Logging.logException(error, "FirmwareStatusNotification", headers.chargeBoxIdentity, MODULE_NAME, "FirmwareStatusNotification", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 status of type FirmwareStatus|s:string|Downloaded,DownloadFailed,InstallationFailed,Installed
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      },
      DiagnosticsStatusNotification: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_12).handleDiagnosticsStatusNotification(payload).then(function (result) {
            // Log
            Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", {
              "result": result
            });
            callback({
              'diagnosticsStatusNotificationResponse': {}
            });
          });
        } catch (error) {
          // Log
          Logging.logException(error, "DiagnosticsStatusNotification", headers.chargeBoxIdentity, MODULE_NAME, "DiagnosticsStatusNotification", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 status of type DiagnosticsStatus|s:string|Uploaded,UploadFailed
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2010/08/

        }; */
      }
    }
  }
};