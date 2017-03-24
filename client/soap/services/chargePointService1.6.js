vmodule.exports = { /* Services */

  ChargePointService: { /* Ports */

    ChargePointServiceSoap12: { /* Methods */

      CancelReservation: function(args, callback, headers, req) {
        /*
          args = {
                 reservationId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type CancelReservationStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      ChangeAvailability: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 type of type AvailabilityType|s:string|Inoperative,Operative
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type AvailabilityStatus|s:string|Accepted,Rejected,Scheduled
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      ChangeConfiguration: function(args, callback, headers, req) {
        /*
          args = {
                 key of type CiString50Type|s:string|maxLength
                 value of type CiString500Type|s:string|maxLength
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ConfigurationStatus|s:string|Accepted,NotSupported,RebootRequired,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      ClearCache: function(args, callback, headers, req) {
        /*
          args = {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ClearCacheStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      ClearChargingProfile: function(args, callback, headers, req) {
        /*
          args = {
                 id of type s:int
                 connectorId of type s:int
                 chargingProfilePurpose of type ChargingProfilePurposeType|s:string|ChargePointMaxProfile,TxDefaultProfile,TxProfile
                 stackLevel of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ClearChargingProfileStatus|s:string|Accepted,Unknown
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      DataTransfer: function(args, callback, headers, req) {
        /*
          args = {
                 vendorId of type CiString255Type|s:string|maxLength
                 messageId of type CiString50Type|s:string|maxLength
                 data of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type DataTransferStatus|s:string|Accepted,Rejected,UnknownMessageId,UnknownVendorId
                 data of type s:string
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      GetConfiguration: function(args, callback, headers, req) {
        /*
          args = {
                 key[] of type CiString50Type|s:string|maxLength
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 configurationKey[] of type  {
                         key of type CiString50Type|s:string|maxLength
                         readonly of type s:boolean
                         value of type CiString500Type|s:string|maxLength
                         targetNSAlias of type tns
                         targetNamespace of type urn://Ocpp/Cp/2015/10/
                   }
                 unknownKey[] of type CiString50Type|s:string|maxLength
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

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
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 fileName of type CiString255Type|s:string|maxLength
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      GetLocalListVersion: function(args, callback, headers, req) {
        /*
          args = {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 listVersion of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      RemoteStartTransaction: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 idTag of type IdToken|s:string|maxLength
                 chargingProfile of type  {
                         chargingProfileId of type s:int
                         transactionId of type s:int
                         stackLevel of type s:int
                         chargingProfilePurpose of type ChargingProfilePurposeType|s:string|ChargePointMaxProfile,TxDefaultProfile,TxProfile
                         chargingProfileKind of type ChargingProfileKindType|s:string|Absolute,Recurring,Relative
                         recurrencyKind of type RecurrencyKindType|s:string|Daily,Weekly
                         validFrom of type s:dateTime
                         validTo of type s:dateTime
                         chargingSchedule of type  {
                                 duration of type s:int
                                 startSchedule of type s:dateTime
                                 chargingRateUnit of type ChargingRateUnitType|s:string|W,A
                                 chargingSchedulePeriod[] of type  {
                                         startPeriod of type s:int
                                         limit of type DecimalOne|s:decimal|fractionDigits
                                         numberPhases of type s:int
                                         targetNSAlias of type tns
                                         targetNamespace of type urn://Ocpp/Cp/2015/10/
                                   }
                                 minChargingRate of type DecimalOne|s:decimal|fractionDigits
                                 targetNSAlias of type tns
                                 targetNamespace of type urn://Ocpp/Cp/2015/10/
                           }
                         targetNSAlias of type tns
                         targetNamespace of type urn://Ocpp/Cp/2015/10/
                   }
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type RemoteStartStopStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      RemoteStopTransaction: function(args, callback, headers, req) {
        /*
          args = {
                 transactionId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type RemoteStartStopStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      GetCompositeSchedule: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 duration of type s:int
                 chargingRateUnit of type ChargingRateUnitType|s:string|W,A
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type GetCompositeScheduleStatus|s:string|Accepted,Rejected
                 connectorId of type s:int
                 scheduleStart of type s:dateTime
                 chargingSchedule of type  {
                         duration of type s:int
                         startSchedule of type s:dateTime
                         chargingRateUnit of type ChargingRateUnitType|s:string|W,A
                         chargingSchedulePeriod[] of type  {
                                 startPeriod of type s:int
                                 limit of type DecimalOne|s:decimal|fractionDigits
                                 numberPhases of type s:int
                                 targetNSAlias of type tns
                                 targetNamespace of type urn://Ocpp/Cp/2015/10/
                           }
                         minChargingRate of type DecimalOne|s:decimal|fractionDigits
                         targetNSAlias of type tns
                         targetNamespace of type urn://Ocpp/Cp/2015/10/
                   }
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

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
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ReservationStatus|s:string|Accepted,Faulted,Occupied,Rejected,Unavailable
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      Reset: function(args, callback, headers, req) {
        /*
          args = {
                 type of type ResetType|s:string|Hard,Soft
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ResetStatus|s:string|Accepted,Rejected
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      SendLocalList: function(args, callback, headers, req) {
        /*
          args = {
                 listVersion of type s:int
                 localAuthorizationList[] of type  {
                         idTag of type IdToken|s:string|maxLength
                         idTagInfo of type  {
                                 status of type AuthorizationStatus|s:string|Accepted,Blocked,Expired,Invalid,ConcurrentTx
                                 expiryDate of type s:dateTime
                                 parentIdTag of type IdToken|s:string|maxLength
                                 targetNSAlias of type tns
                                 targetNamespace of type urn://Ocpp/Cp/2015/10/
                           }
                         targetNSAlias of type tns
                         targetNamespace of type urn://Ocpp/Cp/2015/10/
                   }
                 updateType of type UpdateType|s:string|Differential,Full
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type UpdateStatus|s:string|Accepted,Failed,NotSupported,VersionMismatch
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      SetChargingProfile: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 csChargingProfiles of type  {
                         chargingProfileId of type s:int
                         transactionId of type s:int
                         stackLevel of type s:int
                         chargingProfilePurpose of type ChargingProfilePurposeType|s:string|ChargePointMaxProfile,TxDefaultProfile,TxProfile
                         chargingProfileKind of type ChargingProfileKindType|s:string|Absolute,Recurring,Relative
                         recurrencyKind of type RecurrencyKindType|s:string|Daily,Weekly
                         validFrom of type s:dateTime
                         validTo of type s:dateTime
                         chargingSchedule of type  {
                                 duration of type s:int
                                 startSchedule of type s:dateTime
                                 chargingRateUnit of type ChargingRateUnitType|s:string|W,A
                                 chargingSchedulePeriod[] of type  {
                                         startPeriod of type s:int
                                         limit of type DecimalOne|s:decimal|fractionDigits
                                         numberPhases of type s:int
                                         targetNSAlias of type tns
                                         targetNamespace of type urn://Ocpp/Cp/2015/10/
                                   }
                                 minChargingRate of type DecimalOne|s:decimal|fractionDigits
                                 targetNSAlias of type tns
                                 targetNamespace of type urn://Ocpp/Cp/2015/10/
                           }
                         targetNSAlias of type tns
                         targetNamespace of type urn://Ocpp/Cp/2015/10/
                   }
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type ChargingProfileStatus|s:string|Accepted,Rejected,NotSupported
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      TriggerMessage: function(args, callback, headers, req) {
        /*
          args = {
                 requestedMessage of type MessageTrigger|s:string|BootNotification,DiagnosticsStatusNotification,FirmwareStatusNotification,Heartbeat,MeterValues,StatusNotification
                 connectorId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type TriggerMessageStatus|s:string|Accepted,Rejected,NotImplemented
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      },
      UnlockConnector: function(args, callback, headers, req) {
        /*
          args = {
                 connectorId of type s:int
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 status of type UnlockStatus|s:string|Unlocked,UnlockFailed,NotSupported
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

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
                 targetNamespace of type urn://Ocpp/Cp/2015/10/
          }
        */
        //
        // Your code
        //
        /* return {
                 targetNSAlias of type tns
                 targetNamespace of type urn://Ocpp/Cp/2015/10/

        }; */
      }

    }
  }
};
