module.exports = { /* Services */

  ChargePointService: { /* Ports */

    ChargePointServiceSoap12: { /* Methods */

      UnlockConnector: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type UnlockStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      Reset: function(args, callback, headers, req) {
        /*
          args = {
                 type of type ResetType|s:string|Hard,Soft
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ResetStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      ChangeAvailability: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 type of type AvailabilityType|s:string|Inoperative,Operative
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type AvailabilityStatus|s:string|Accepted,Rejected,Scheduled
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      GetDiagnostics: function(args, callback, headers, req) {
        /*
          args = {
                 location of type s:anyURI
                 startTime of type s:dateTime
                 stopTime of type s:dateTime
                 retries of type s:int
                 retryInterval of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 fileName of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      ClearCache: function(args, callback, headers, req) {
        /*
          args = {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ClearCacheStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      UpdateFirmware: function(args, callback, headers, req) {
        /*
          args = {
                 retrieveDate of type s:dateTime
                 location of type s:anyURI
                 retries of type s:int
                 retryInterval of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      ChangeConfiguration: function(args, callback, headers, req) {
        /*
          args = {
                 key of type s:string
                 value of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ConfigurationStatus|s:string|Accepted,Rejected,NotSupported
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      RemoteStartTransaction: function(args, callback, headers, req) {
        /*
          args = {
                 idTag of type s:string
                 connectorId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type RemoteStartStopStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      },
      RemoteStopTransaction: function(args, callback, headers, req) {
        /*
          args = {
                 transactionId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type RemoteStartStopStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2010/08/

        }; */
      }

    }
  }
};
