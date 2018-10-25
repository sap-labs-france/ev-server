const Logging = require('../../../../utils/Logging');
const Utils = require('../../../../utils/Utils');
const Constants = require('../../../../utils/Constants');

const _moduleName = "SoapCentralSystemService12";

module.exports = { /* Services */
	CentralSystemService: { /* Ports */
		CentralSystemServiceSoap12: { /* Methods */
			Authorize: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "Authorize", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleAuthorize(Object.assign(args, headers)).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "Authorize", {
              "result": result
            });
            // Answer
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "Authorize", headers.chargeBoxIdentity, MODULE_NAME, "Authorize");
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
			StartTransaction: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "StartTransaction", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleStartTransaction(Object.assign(args, headers)).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "StartTransaction", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "StartTransaction", headers.chargeBoxIdentity, MODULE_NAME, "StartTransaction");
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
			StopTransaction: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "StopTransaction", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleStopTransaction(Object.assign(args, headers)).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "StopTransaction", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "StopTransaction", headers.chargeBoxIdentity, MODULE_NAME, "StopTransaction");
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
			Heartbeat: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "Heartbeat", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleHeartbeat(headers).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "Heartbeat", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "Heartbeat", headers.chargeBoxIdentity, MODULE_NAME, "Heartbeat");
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
			MeterValues: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "MeterValues", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleMeterValues(Object.assign(args, headers)).then(function(result) {
            // Return the result async
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "MeterValues", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "MeterValues", headers.chargeBoxIdentity, MODULE_NAME, "MeterValues");
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
			BootNotification: function(args, callback, headers, req) {
        try {
          // Add OCPP Version
          headers.ocppVersion = '1.2';
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "BootNotification", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleBootNotification(Object.assign(args, headers)).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "BootNotification", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "BootNotification", headers.chargeBoxIdentity, MODULE_NAME, "BootNotification");
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
			StatusNotification: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "StatusNotification", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleStatusNotification(Object.assign(args, headers)).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "StatusNotification", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "StatusNotification", headers.chargeBoxIdentity, MODULE_NAME, "StatusNotification");
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
			FirmwareStatusNotification: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "FirmwareStatusNotification", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleFirmwareStatusNotification(Object.assign(args, headers)).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "FirmwareStatusNotification", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "FirmwareStatusNotification", headers.chargeBoxIdentity, MODULE_NAME, "FirmwareStatusNotification");
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
			DiagnosticsStatusNotification: function(args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Log
          Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", args, headers);
          // Handle
          global.centralSystemSoap.getCentralChargingStationService(Constants.OCPP_VERSION_12).handleDiagnosticsStatusNotification(Object.assign(args, headers)).then(function(result) {
            // Log
            Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", {
              "result": result
            });
            callback(result);
          });
        } catch(error) {
          // Log
          Logging.logException(error, "DiagnosticsStatusNotification", headers.chargeBoxIdentity, MODULE_NAME, "DiagnosticsStatusNotification");
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
