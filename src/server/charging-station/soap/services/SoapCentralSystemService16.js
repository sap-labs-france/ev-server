const Logging = require('../../../../utils/Logging');
const Utils = require('../../../../utils/Utils');
const Constants = require('../../../../utils/Constants');

const MODULE_NAME = "SoapCentralSystemService16";

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleAuthorize(payload).then(function (result) {
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
        				 idTag of type IdToken|s:string|maxLength
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 idTagInfo of type  {
        								 status of type AuthorizationStatus|s:string|Accepted,Blocked,Expired,Invalid,ConcurrentTx
        								 expiryDate of type s:dateTime
        								 parentIdTag of type IdToken|s:string|maxLength
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2015/10/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

        }; */
      },
      BootNotification: function (args, callback, headers, req) {
        try {
          // Add OCPP Version
          headers.ocppVersion = Constants.OCPP_VERSION_16;
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "BootNotification", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleBootNotification(payload).then(function (result) {
            // Log
            Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "BootNotification", {
              "result": result
            });
            // Response
            callback({
              'bootNotificationResponse': {
                'status': result.status,
                'currentTime': result.currentTime,
                'interval': result.heartbeatInterval
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
        				 chargePointVendor of type CiString20Type|s:string|maxLength
        				 chargePointModel of type CiString20Type|s:string|maxLength
        				 chargePointSerialNumber of type CiString25Type|s:string|maxLength
        				 chargeBoxSerialNumber of type CiString25Type|s:string|maxLength
        				 firmwareVersion of type CiString50Type|s:string|maxLength
        				 iccid of type CiString20Type|s:string|maxLength
        				 imsi of type CiString20Type|s:string|maxLength
        				 meterType of type CiString25Type|s:string|maxLength
        				 meterSerialNumber of type CiString25Type|s:string|maxLength
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */

        /* return {
        				 status of type RegistrationStatus|s:string|Accepted,Pending,Rejected
        				 currentTime of type s:dateTime
        				 interval of type s:int
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

        }; */
      },
      DataTransfer: function (args, callback, headers, req) {
        try {
          // Normalize Header
          Utils.normalizeSOAPHeader(headers);
          // Payload
          const payload = Object.assign({}, args, headers);
          // Log
          Logging.logReceivedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DataTransfer", payload);
          // Handle
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleDataTransfer(payload).then(function (result) {
            // Log
            Logging.logReturnedAction(MODULE_NAME, headers.tenantID, headers.chargeBoxIdentity, "DataTransfer", {
              "result": result
            });
            callback({
              'dataTransferResponse': {
                'status': result.status
              }
            });
          });
        } catch (error) {
          // Log
          Logging.logException(error, "DataTransfer", headers.chargeBoxIdentity, MODULE_NAME, "DataTransfer", headers.tenantID);
          // Rethrow
          throw error;
        }

        /*
        	args = {
        				 vendorId of type CiString255Type|s:string|maxLength
        				 messageId of type CiString50Type|s:string|maxLength
        				 data of type s:string
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 status of type DataTransferStatus|s:string|Accepted,Rejected,UnknownMessageId,UnknownVendorId
        				 data of type s:string
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleDiagnosticsStatusNotification(payload).then(function (result) {
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
        				 status of type DiagnosticsStatus|s:string|Idle,Uploaded,UploadFailed,Uploading
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleFirmwareStatusNotification(payload).then(function (result) {
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
        				 status of type FirmwareStatus|s:string|Downloaded,DownloadFailed,Downloading,Idle,InstallationFailed,Installed,Installing
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleHeartBeat(payload).then(function (result) {
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
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 currentTime of type s:dateTime
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleMeterValues(payload).then(function (result) {
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
        				 transactionId of type s:int
        				 meterValue[] of type  {
        								 timestamp of type s:dateTime
        								 sampledValue[] of type  {
        												 value of type s:string
        												 context of type ReadingContext|s:string|Interruption.Begin,Interruption.End,Other,Sample.Clock,Sample.Periodic,Transaction.Begin,Transaction.End,Trigger
        												 format of type ValueFormat|s:string|Raw,SignedData
        												 measurand of type Measurand|s:string|Current.Export,Current.Import,Current.Offered,Energy.Active.Export.Register,Energy.Active.Import.Register,Energy.Reactive.Export.Register,Energy.Reactive.Import.Register,Energy.Active.Export.Interval,Energy.Active.Import.Interval,Energy.Reactive.Export.Interval,Energy.Reactive.Import.Interval,Frequency,Power.Active.Export,Power.Active.Import,Power.Factor,Power.Offered,Power.Reactive.Export,Power.Reactive.Import,RPM,SoC,Temperature,Voltage
        												 phase of type Phase|s:string|L1,L2,L3,N,L1-N,L2-N,L3-N,L1-L2,L2-L3,L3-L1
        												 location of type Location|s:string|Body,Cable,EV,Inlet,Outlet
        												 unit of type UnitOfMeasure|s:string|Celsius,Fahrenheit,Wh,kWh,varh,kvarh,W,kW,VA,kVA,var,kvar,A,V,K,Percent
        												 targetNSAlias of type tns
        												 targetNamespace of type urn://Ocpp/Cs/2015/10/
        									 }
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2015/10/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleStartTransaction(payload).then(function (result) {
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
        				 idTag of type IdToken|s:string|maxLength
        				 timestamp of type s:dateTime
        				 meterStart of type s:int
        				 reservationId of type s:int
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
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
        								 parentIdTag of type IdToken|s:string|maxLength
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2015/10/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleStatusNotification(payload).then(function (result) {
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
        				 status of type ChargePointStatus|s:string|Available,Preparing,Charging,SuspendedEV,SuspendedEVSE,Finishing,Reserved,Faulted,Unavailable
        				 errorCode of type ChargePointErrorCode|s:string|ConnectorLockFailure,EVCommunicationError,GroundFailure,HighTemperature,InternalError,LocalListConflict,NoError,OtherError,OverCurrentFailure,OverVoltage,PowerMeterFailure,PowerSwitchFailure,ReaderFailure,ResetFailure,UnderVoltage,WeakSignal
        				 info of type CiString50Type|s:string|maxLength
        				 timestamp of type s:dateTime
        				 vendorId of type CiString255Type|s:string|maxLength
        				 vendorErrorCode of type CiString50Type|s:string|maxLength
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

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
          global.centralSystemSoap.getChargingStationService(Constants.OCPP_VERSION_16).handleStopTransaction(payload).then(function (result) {
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
        				 idTag of type IdToken|s:string|maxLength
        				 timestamp of type s:dateTime
        				 meterStop of type s:int
        				 reason of type Reason|s:string|EmergencyStop,EVDisconnected,HardReset,Local,Other,PowerLoss,Reboot,Remote,SoftReset,UnlockCommand,DeAuthorized
        				 transactionData[] of type  {
        								 timestamp of type s:dateTime
        								 sampledValue[] of type  {
        												 value of type s:string
        												 context of type ReadingContext|s:string|Interruption.Begin,Interruption.End,Other,Sample.Clock,Sample.Periodic,Transaction.Begin,Transaction.End,Trigger
        												 format of type ValueFormat|s:string|Raw,SignedData
        												 measurand of type Measurand|s:string|Current.Export,Current.Import,Current.Offered,Energy.Active.Export.Register,Energy.Active.Import.Register,Energy.Reactive.Export.Register,Energy.Reactive.Import.Register,Energy.Active.Export.Interval,Energy.Active.Import.Interval,Energy.Reactive.Export.Interval,Energy.Reactive.Import.Interval,Frequency,Power.Active.Export,Power.Active.Import,Power.Factor,Power.Offered,Power.Reactive.Export,Power.Reactive.Import,RPM,SoC,Temperature,Voltage
        												 phase of type Phase|s:string|L1,L2,L3,N,L1-N,L2-N,L3-N,L1-L2,L2-L3,L3-L1
        												 location of type Location|s:string|Body,Cable,EV,Inlet,Outlet
        												 unit of type UnitOfMeasure|s:string|Celsius,Fahrenheit,Wh,kWh,varh,kvarh,W,kW,VA,kVA,var,kvar,A,V,K,Percent
        												 targetNSAlias of type tns
        												 targetNamespace of type urn://Ocpp/Cs/2015/10/
        									 }
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2015/10/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/
        	}
        */
        //
        // Your code
        //
        /* return {
        				 idTagInfo of type  {
        								 status of type AuthorizationStatus|s:string|Accepted,Blocked,Expired,Invalid,ConcurrentTx
        								 expiryDate of type s:dateTime
        								 parentIdTag of type IdToken|s:string|maxLength
        								 targetNSAlias of type tns
        								 targetNamespace of type urn://Ocpp/Cs/2015/10/
        					 }
        				 targetNSAlias of type tns
        				 targetNamespace of type urn://Ocpp/Cs/2015/10/

        }; */
      }
    }
  }
};