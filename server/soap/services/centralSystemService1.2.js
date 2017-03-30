module.exports = { /* Services */

  CentralSystemService: { /* Ports */

    CentralSystemServiceSoap12: { /* Methods */

      Authorize: function(args, callback, headers, req) {
        // Log
        console.log("Authorize OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleAuthorize(args, headers, req).then(function(result) {
          callback(result);
        });

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
        // Log
        console.log("StartTransaction OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleStartTransaction(args, headers, req).then(function(result) {
          callback(result);
        });

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
        // Log
        console.log("StopTransaction OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleStopTransaction(args, headers, req).then(function(result) {
          callback(result);
        });

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
        // Log
        console.log("Heartbeat OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleHeartBeat(args, headers, req).then(function(result) {
          callback(result);
        });

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
        // Log
        console.log("MeterValues OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleMeterValues(args, headers, req).then(function(result) {
          callback(result);
        });


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
        // Log
        console.log("BootNotification OCPP V 1.2\n");

        // Add OCPP Version
        args.ocppVersion = '1.2';

        // Handle
        global.centralSystemSoap.handleBootNotification(args, headers, req).then(function(result) {
          callback(result);
        });

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
        // Log
        console.log("StatusNotification OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleStatusNotification(args, headers, req).then(function(result) {
          callback(result);
        });

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
        // Log
        console.log("FirmwareStatusNotification OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleFirmwareStatusNotification(args, headers, req).then(function(result) {
          callback(result);
        });

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
        // Log
        console.log("DiagnosticsStatusNotification OCPP V 1.2\n");

        // Handle
        global.centralSystemSoap.handleDiagnosticsStatusNotification(args, headers, req).then(function(result) {
          callback(result);
        });

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
