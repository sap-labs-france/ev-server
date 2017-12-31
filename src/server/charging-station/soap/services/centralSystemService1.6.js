const Logging = require('../../../../utils/Logging');

var _moduleName = "centralSystemService1.6";

module.exports = { /* Services */
	CentralSystemService: { /* Ports */
		CentralSystemServiceSoap12: { /* Methods */
			Authorize: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "Authorize", args, headers);
				// Handle
				global.centralSystemSoap.handleAuthorize(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "Authorize", result);
					// Answer
					callback(result);
				});

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
			BootNotification: function(args, callback, headers, req) {
				// Add OCPP Version
				args.ocppVersion = '1.6';
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "BootNotification", args, headers);
				// Handle
				global.centralSystemSoap.handleBootNotification(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "BootNotification", result);
					callback(result);
				});

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
			DataTransfer: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "DataTransfer", args, headers);
				// Handle
				global.centralSystemSoap.handleDataTransfer(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "DataTransfer", result);
					callback(result);
				});

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
			DiagnosticsStatusNotification: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", args, headers);
				// Handle
				global.centralSystemSoap.handleDiagnosticsStatusNotification(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "DiagnosticsStatusNotification", result);
					callback(result);
				});

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
			FirmwareStatusNotification: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "FirmwareStatusNotification", args, headers);
				// Handle
				global.centralSystemSoap.handleFirmwareStatusNotification(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "FirmwareStatusNotification", result);
					callback(result);
				});

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
			Heartbeat: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "Heartbeat", args, headers);
				// Handle
				global.centralSystemSoap.handleHeartBeat(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "Heartbeat", result);
					callback(result);
				});

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
			MeterValues: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "MeterValues", args, headers);

				// Handle
				global.centralSystemSoap.handleMeterValues(args, headers, req).then(function(result) {
					// Return the result async
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "MeterValues", result);
					callback(result);
				});


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
			StartTransaction: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "StartTransaction", args, headers);
				// Handle
				global.centralSystemSoap.handleStartTransaction(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "StartTransaction", result);
					callback(result);
				});

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
			StatusNotification: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "StatusNotification", args, headers);
				// Handle
				global.centralSystemSoap.handleStatusNotification(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "StatusNotification", result);
					callback(result);
				});

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
			StopTransaction: function(args, callback, headers, req) {
				// Log
				Logging.logReceivedAction(_moduleName, headers.chargeBoxIdentity, "StopTransaction", args, headers);
				// Handle
				global.centralSystemSoap.handleStopTransaction(args, headers, req).then(function(result) {
					// Log
					Logging.logReturnedAction(_moduleName, headers.chargeBoxIdentity, "StopTransaction", result);
					callback(result);
				});

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
