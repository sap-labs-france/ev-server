const ChargingStation = require('../../model/ChargingStation');
const chargePointService12Wsdl = require('../../client/soap/wsdl/OCPP_ChargePointService1.2.wsdl');
const chargePointService15Wsdl = require('../../client/soap/wsdl/OCPP_ChargePointService1.5.wsdl');
const chargePointService16Wsdl = require('../../client/soap/wsdl/OCPP_ChargePointService1.6.wsdl');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');
const Database = require('../../utils/Database');
const bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const locale = require('locale');
const NotificationHandler = require('../../notification/NotificationHandler');
require('source-map-support').install();

let _centralSystemConfig;
let _chargingStationConfig;

class CentralSystemServer {
	// Common constructor for Central System Server
	constructor(centralSystemConfig, chargingStationConfig, app) {
		// Check
		if (new.target === CentralSystemServer) {
			throw new TypeError("Cannot construct CentralSystemServer instances directly");
		}

		// Body parser
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: false }));
		app.use(bodyParser.xml());

		// log to console
		app.use(morgan('dev'));

		// Cross origin headers
		app.use(cors());

		// Secure the application
		app.use(helmet());

		// Default, serve the index.html
		app.get(/^\/wsdl(.+)$/, function(req, res, next) {
			// WDSL file?
			switch (req.params["0"]) {
				// Charge Point WSDL 1.2
				case '/OCPP_ChargePointService1.2.wsdl':
					res.send(chargePointService12Wsdl);
					break;
				// Charge Point WSDL 1.5
				case '/OCPP_ChargePointService1.5.wsdl':
					res.send(chargePointService15Wsdl);
					break;
				// Charge Point WSDL 1.6
				case '/OCPP_ChargePointService1.6.wsdl':
					res.send(chargePointService16Wsdl);
					break;
				// Unknown
				default:
					res.status(500).send(`${req.params["0"]} does not exist!`);
			}
		});

		// Keep params
		_centralSystemConfig = centralSystemConfig;
		_chargingStationConfig = chargingStationConfig;
	}

	// Start the server (to be defined in sub-classes)
	start() {
		// Done in the subclass
	}

	handleBootNotification(args, headers, req) {
		// Set the endpoint
		args.endpoint = headers.From.Address;
		// Set the ChargeBox ID
		args.id = headers.chargeBoxIdentity;
		// Set the default Heart Beat
		args.lastReboot = new Date().toISOString();
		args.lastHeartBeat = args.lastReboot;
		args.timestamp = args.lastReboot;

		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			if (!chargingStation) {
				// Save Charging Station
				chargingStation = new ChargingStation(args);
			} else {
				// Update data
				Database.updateChargingStation(args, chargingStation.getModel());
			}
			// Save Charging Station
			return chargingStation.save().then(() => {
				// Save the Boot Notification
				return chargingStation.saveBootNotification(args);
			}).then(() => {
				// Log
				Logging.logInfo({
					source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
					action: "BootNotification", message: `Changing Station has just rebooted`,
					detailedMessages: args });
				// Get the Charging Station Config
				return chargingStation.requestGetConfiguration();
			// Save the config
			}).then((configuration) => {
				// Save it
				if (configuration) {
					return chargingStation.saveConfiguration(configuration);
				} else {
					// Log
					return Promise.reject(new Error(`Cannot retrieve the Configuration of ${headers.chargeBoxIdentity}`));
				}
			// Return the result
			}).then(() => {
				// Log
				Logging.logInfo({
					source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleBootNotification",
					action: "BootNotification", message: `Charging Station's Configuration has been updated` });

				// Return the result
				// OCPP 1.6
				if (args.ocppVersion === "1.6") {
					return {
						"bootNotificationResponse": {
							"status": 'Accepted',
							"currentTime": new Date().toISOString(),
							"interval": _chargingStationConfig.heartbeatIntervalSecs
						}
					};
					// OCPP 1.2 && 1.5
				} else {
					return {
						"bootNotificationResponse": {
							"status": 'Accepted',
							"currentTime": new Date().toISOString(),
							"heartbeatInterval": _chargingStationConfig.heartbeatIntervalSecs
						}
					};
				}
			}).catch((error) => {
				// Log error
				Logging.logUnexpectedErrorMessage(
					"BootNotification",
					"CentralSystemServer",
					"handleBootNotification",
					error,
					headers.chargeBoxIdentity);
				// Reject
				return {
					"bootNotificationResponse": {
						"status": 'Rejected',
						"currentTime": new Date().toISOString(),
						"heartbeatInterval": _chargingStationConfig.heartbeatIntervalSecs
					}
				};
			});
		});
	}

	handleHeartBeat(args, headers, req) {
		var heartBeat = new Date();

		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Set Heartbeat
				chargingStation.setLastHeartBeat(heartBeat);
				// Save
				return chargingStation.save().then(()=> {
					// Log
					Logging.logDebug({
						source: headers.chargeBoxIdentity,
						module: "CentralSystemServer", method: "handleHeartBeat",
						action: "HeartBeat", message: `HeartBeat received`,
						detailedMessages: heartBeat });
				});
			}
		}).then(() => {
			return {
				"heartbeatResponse": {
					"currentTime": heartBeat.toISOString()
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"HeartBeat",
				"CentralSystemServer",
				"handleHeartBeat",
				error,
				headers.chargeBoxIdentity);
			// Send the response
			return {
				"heartbeatResponse": {
					"currentTime": heartBeat.toISOString()
				}
			};
		});
	}

	handleStatusNotification(args, headers, req) {
		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Check if error
				if (args.status === "Faulted") {
					// Log
					Logging.logError({
						source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStatusNotification",
						action: "StatusNotification", message: `The Charging Station ${headers.chargeBoxIdentity} has reported an error on connector ${args.connectorId}: ${args.status} - ${args.errorCode}` });
					// Send Notification
					NotificationHandler.sendChargingStationStatusError(
						Utils.generateGUID(),
						chargingStation.getModel(),
						{
							"chargingStationId": chargingStation.getChargeBoxIdentity(),
							"connectorId": args.connectorId,
							"error": `${args.status} - ${args.errorCode}`,
							"evseDashboardChargingStationURL" : Utils.buildEvseChargingStationURL(chargingStation, args.connectorId)
						}
					);
				}
				// Save
				return chargingStation.saveStatusNotification(args);
			}
		}).then(() => {
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStatusNotification",
				action: "StatusNotification", message: `Status Notification '${args.status}-${args.errorCode}' from Connector '${args.connectorId}' has been received`,
				detailedMessages: args });

			return {
				"statusNotificationResponse": {
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"StatusNotification",
				"CentralSystemServer",
				"handleStatusNotification",
				error,
				headers.chargeBoxIdentity);
			// Return
			return {
				"statusNotificationResponse": {
				}
			};
		});
	}

	handleMeterValues(args, headers, req) {
		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Save
				return chargingStation.saveMeterValues(args);
			}
		}).then(() => {
			// Log
			Logging.logDebug({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleMeterValues",
				action: "MeterValues", message: `Meter Values have been received for Transaction ID '${args.transactionId}' and Connector '${args.connectorId}'`,
				detailedMessages: args });
			return {
				"meterValuesResponse": {
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"MeterValues",
				"CentralSystemServer",
				"handleMeterValues",
				error,
				headers.chargeBoxIdentity);
			// Response
			return {
				"meterValuesResponse": {
				}
			};
		});
	}

	handleAuthorize(args, headers, req) {
		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Save
				return chargingStation.saveAuthorize(args);
			} else {
				// Error
				return Promise.reject(new Error(`Charging Station ${headers.chargeBoxIdentity} does not exist`));
			}
		}).then(() => {
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleAuthorize",
				action: "Authorize", message: `User '${Utils.buildUserFullName(args.user._model)}' has been authorized to use the Charging Station`,
				detailedMessages: args });

			return {
				"authorizeResponse": {
					"idTagInfo": {
						"status": "Accepted"
						//          "expiryDate": "",
						//          "parentIdTag": ""
					}
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"Authorize",
				"CentralSystemServer",
				"handleAuthorize",
				error,
				headers.chargeBoxIdentity);
			return {
				"authorizeResponse": {
					"idTagInfo": {
						"status": "Invalid"
						//          "expiryDate": "",
						//          "parentIdTag": ""
					}
				}
			};
		});
	}

	handleDiagnosticsStatusNotification(args, headers, req) {
		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Save
				return chargingStation.saveDiagnosticsStatusNotification(args);
			}
		}).then(() => {
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDiagnosticsStatusNotification",
				action: "DiagnosticsStatusNotification", message: `Diagnostics Status Notification has been received`,
				detailedMessages: args });

			return {
				"diagnosticsStatusNotificationResponse": {
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"DiagnosticsStatusNotification",
				"CentralSystemServer",
				"handleDiagnosticsStatusNotification",
				error,
				headers.chargeBoxIdentity);
			return {
				"diagnosticsStatusNotificationResponse": {
				}
			};
		});
	}

	handleFirmwareStatusNotification(args, headers, req) {
		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Save
				return chargingStation.saveFirmwareStatusNotification(args);
			}
		}).then(() => {
			// Log
			Logging.logDebug({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleFirmwareStatusNotification",
				action: "FirmwareStatusNotification", message: `Firmware Status Notification has been received`,
				detailedMessages: args });
			return {
				"firmwareStatusNotificationResponse": {
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"FirmwareStatusNotification",
				"CentralSystemServer",
				"handleFirmwareStatusNotification",
				error,
				headers.chargeBoxIdentity);
			return {
				"firmwareStatusNotificationResponse": {
				}
			};
		});
}

	handleStartTransaction(args, headers, req) {
		// Set the transaction ID
		args.transactionId = Utils.getRandomInt();

		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Save
				return chargingStation.saveStartTransaction(args);
			} else {
				// Reject but save ok
				return Promise.reject( new Error(`Transaction rejected: Charging Station  ${headers.chargeBoxIdentity} does not exist`) );
			}
		}).then(() => {
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStartTransaction",
				action: "StartTransaction", message: `Transaction ID '${args.transactionId}' has been started by '${Utils.buildUserFullName(args.user._model)}' on Connector '${args.connectorId}'`,
				detailedMessages: args });

			return {
				"startTransactionResponse": {
					"transactionId": args.transactionId,
					"idTagInfo": {
						"status": "Accepted"
	//          "expiryDate": "",
	//          "parentIdTag": ""
					}
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"StartTransaction",
				"CentralSystemServer",
				"handleStartTransaction",
				error,
				headers.chargeBoxIdentity);
			return {
				"startTransactionResponse": {
					"transactionId": args.transactionId,
					"idTagInfo": {
						"status": "Invalid"
	//          "expiryDate": "",
	//          "parentIdTag": ""
					}
				}
			};
		});
	}

	handleDataTransfer(args, headers, req) {
		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Save
				return chargingStation.saveDataTransfer(args);
			}
		}).then(() => {
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDataTransfer",
				action: "DataTransfer", message: `Data Transfer has been received`,
				detailedMessages: args });
			return {
				"dataTransferResponse": {
					"status": "Accepted"
	//        "data": ""
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"DataTransfer",
				"CentralSystemServer",
				"handleDataTransfer",
				error,
				headers.chargeBoxIdentity);
			return {
				"dataTransferResponse": {
					"status": "Rejected"
				}
			};
		});
	}

	handleStopTransaction(args, headers, req) {
		// Get the charging station
		return global.storage.getChargingStation(headers.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (chargingStation) {
				// Save
				return chargingStation.saveStopTransaction(args);
			}
		}).then(() => {
			let message;
			if (args.user) {
				message = `Transaction ID '${args.transactionId}' has been stopped by '${Utils.buildUserFullName(args.user._model)}'`;
			} else {
				message = `Transaction ID '${args.transactionId}' has been stopped`;
			}
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStopTransaction",
				action: "StopTransaction", message: message,
				detailedMessages: args });
			// Success
			return {
				"stopTransactionResponse": {
					"idTagInfo": {
						"status": "Accepted"
	//          "expiryDate": "",
	//          "parentIdTag": "",
					}
				}
			};
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(
				"StopTransaction",
				"CentralSystemServer",
				"handleStopTransaction",
				error,
				headers.chargeBoxIdentity);
			// Error
			return {
				"stopTransactionResponse": {
					"idTagInfo": {
						"status": "Invalid"
	//          "expiryDate": "",
	//          "parentIdTag": "",
					}
				}
			};
		});
	}
}

module.exports = CentralSystemServer;
