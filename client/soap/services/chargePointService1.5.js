module.exports = { /* Services */

  ChargePointService: { /* Ports */

    ChargePointServiceSoap12: { /* Methods */

      UnlockConnector: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type UnlockStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      Reset: function(args, callback, headers, req) {
        /*
          args = {
                 type of type ResetType|s:string|Hard,Soft
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ResetStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      ChangeAvailability: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 type of type AvailabilityType|s:string|Inoperative,Operative
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type AvailabilityStatus|s:string|Accepted,Rejected,Scheduled
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

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
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 fileName of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      ClearCache: function(args, callback, headers, req) {
        /*
          args = {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ClearCacheStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

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
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      ChangeConfiguration: function(args, callback, headers, req) {
        /*
          args = {
                 key of type s:string
                 value of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ConfigurationStatus|s:string|Accepted,Rejected,NotSupported
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      RemoteStartTransaction: function(args, callback, headers, req) {
        /*
          args = {
                 idTag of type IdToken|s:string|maxLength
                 connectorId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type RemoteStartStopStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      RemoteStopTransaction: function(args, callback, headers, req) {
        /*
          args = {
                 transactionId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type RemoteStartStopStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      CancelReservation: function(args, callback, headers, req) {
        /*
          args = {
                 reservationId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type CancelReservationStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      DataTransfer: function(args, callback, headers, req) {
        /*
          args = {
                 vendorId of type s:string
                 messageId of type s:string
                 data of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type DataTransferStatus|s:string|Accepted,Rejected,UnknownMessageId,UnknownVendorId
                 data of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      GetConfiguration: function(args, callback, headers, req) {
        /*
          args = {
                 key[] of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 configurationKey[] of type  {
                         key of type s:string
                         readonly of type s:boolean
                         value of type s:string
                         targetNSAlias of type tns
                         targetNamespace of type urn://Ocpp/Cp/2012/06/
                   }
                 unknownKey[] of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      GetLocalListVersion: function(args, callback, headers, req) {
        /*
          args = {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 listVersion of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      ReserveNow: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 expiryDate of type s:dateTime
                 idTag of type IdToken|s:string|maxLength
                 parentIdTag of type IdToken|s:string|maxLength
                 reservationId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ReservationStatus|s:string|Accepted,Faulted,Occupied,Rejected,Unavailable
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      },
      SendLocalList: function(args, callback, headers, req) {
        /*
          args = {
                 updateType of type UpdateType|s:string|Differential,Full
                 listVersion of type s:int
                 localAuthorisationList[] of type  {
                         idTag of type IdToken|s:string|maxLength
                         idTagInfo of type  {
                                 status of type AuthorizationStatus|s:string|Accepted,Blocked,Expired,Invalid,ConcurrentTx
                                 expiryDate of type s:dateTime
                                 parentIdTag of type IdToken|s:string|maxLength
                                 targetNSAlias of type tns
                                 targetNamespace of type urn://Ocpp/Cp/2012/06/
                           }
                         targetNSAlias of type tns
                         targetNamespace of type urn://Ocpp/Cp/2012/06/
                   }
                 hash of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type UpdateStatus|s:string|Accepted,Failed,HashError,NotSupported,VersionMismatch
                 hash of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2012/06/

        }; */
      }

    }
  }
};
