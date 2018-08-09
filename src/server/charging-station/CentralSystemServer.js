const ChargingStation = require('../../model/ChargingStation');
const chargePointService12Wsdl = require('../../client/soap/wsdl/OCPP_ChargePointService1.2.wsdl');
const chargePointService15Wsdl = require('../../client/soap/wsdl/OCPP_ChargePointService1.5.wsdl');
const chargePointService16Wsdl = require('../../client/soap/wsdl/OCPP_ChargePointService1.6.wsdl');
const AppError = require('../../exception/AppError');
const Logging = require('../../utils/Logging');
const bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const sanitize = require('mongo-sanitize');
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
					res.status(500).send(`${sanitize(req.params["0"])} does not exist!`);
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

	async checkAndGetChargingStation(chargeBoxIdentity) {
		// Get the charging station
		let chargingStation = await global.storage.getChargingStation(chargeBoxIdentity);
		// Found?
		if (!chargingStation) {
			throw new AppError(
				chargeBoxIdentity,
				`Charging Station does not exist`,
				550, "CentralSystemServer", "checkAndGetChargingStation");
		}
		// Found?
		if (chargingStation.isDeleted()) {
			throw new AppError(
				chargeBoxIdentity,
				`Charging Station is deleted`,
				550, "CentralSystemServer", "checkAndGetChargingStation");
		}
		return chargingStation;
	}

	async handleBootNotification(args, headers, req) {
		try{
				// Set the endpoint
			args.endpoint = headers.From.Address;
			// Set the ChargeBox ID
			args.id = headers.chargeBoxIdentity;
			// Set the default Heart Beat
			args.lastReboot = new Date();
			args.lastHeartBeat = args.lastReboot;
			args.timestamp = args.lastReboot;

			// Get the charging station
			let chargingStation = await global.storage.getChargingStation(headers.chargeBoxIdentity);
			if (!chargingStation) {
				// Save Charging Station
				chargingStation = new ChargingStation(args);
				// Set the URL = enpoint
				chargingStation.setChargingStationURL(chargingStation.getEndPoint());
				// Update timestamp
				chargingStation.setCreatedOn(new Date());
				chargingStation.setLastHeartBeat(new Date());
			} else {
				// Set the URL = enpoint
				if (!chargingStation.getChargingStationURL()) {
					chargingStation.setChargingStationURL(chargingStation.getEndPoint())
				}
				// Update data
				chargingStation.setChargePointVendor(args.chargePointVendor);
				chargingStation.setChargePointModel(args.chargePointModel);
				chargingStation.setChargePointSerialNumber(args.chargePointSerialNumber);
				chargingStation.setChargeBoxSerialNumber(args.chargeBoxSerialNumber);
				chargingStation.setFirmwareVersion(args.firmwareVersion);
				chargingStation.setOcppVersion(args.ocppVersion);
				chargingStation.setLastHeartBeat(new Date());
				// Back again
				chargingStation.setDeleted(false);
			}
			// Save Charging Station
			let updatedChargingStation = await chargingStation.save();
			// Save the Boot Notification
			await updatedChargingStation.handleBootNotification(args);
			// Log
			Logging.logDebug({
				source: chargingStation.getID(),
				module: "CentralSystemServer", method: "handleBootNotification",
				action: "BootNotification",
				message: `Rebooted with success`,
				detailedMessages: args });

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
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("BootNotification", error);
			// Reject
			return {
				"bootNotificationResponse": {
					"status": 'Rejected',
					"currentTime": new Date().toISOString(),
					"heartbeatInterval": _chargingStationConfig.heartbeatIntervalSecs
				}
			};
		}
	}

	async handleHeartBeat(args, headers, req) {
		try {
			var heartBeat = new Date();
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Set Heartbeat
			chargingStation.setLastHeartBeat(heartBeat);
			// Save
			await chargingStation.saveHeartBeat();
			// Log
			Logging.logDebug({
				source: headers.chargeBoxIdentity,
				module: "CentralSystemServer", method: "handleHeartBeat",
				action: "HeartBeat", message: `HeartBeat received`,
				detailedMessages: heartBeat
			});
			return {
				"heartbeatResponse": {
					"currentTime": heartBeat.toISOString()
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("HeartBeat", error);
			// Send the response
			return {
				"heartbeatResponse": {
					"currentTime": heartBeat.toISOString()
				}
			};
		}
	}

	async handleStatusNotification(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Handle
			await chargingStation.handleStatusNotification(args);
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStatusNotification",
				action: "StatusNotification", message: `Status Notification '${args.status}-${args.errorCode}' from Connector '${args.connectorId}' has been received`,
				detailedMessages: args });

			return {
				"statusNotificationResponse": {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("StatusNotification", error);
			// Return
			return {
				"statusNotificationResponse": {
				}
			};
		}
	}

	async handleMeterValues(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Save
			await chargingStation.handleMeterValues(args);
			// Log
			Logging.logDebug({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleMeterValues",
				action: "MeterValues", message: `Meter Values have been received for Transaction ID '${args.transactionId}' and Connector '${args.connectorId}'`,
				detailedMessages: args });
			// Return
			return {
				"meterValuesResponse": {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("MeterValues", error);
			// Response
			return {
				"meterValuesResponse": {
				}
			};
		}
	}

	async handleAuthorize(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Handle
			await chargingStation.handleAuthorize(args);
			// Log
			if (args.user) {
				// Log
				Logging.logInfo({
					source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleAuthorize",
					action: "Authorize", user: args.user.getModel(),
					message: `User has been authorized to use Charging Station`,
					detailedMessages: args });
			} else {
				// Log
				Logging.logInfo({
					source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleAuthorize",
					action: "Authorize", message: `An anonymous user has been authorized to use the Charging Station`,
					detailedMessages: args });
			}
			// Return
			return {
				"authorizeResponse": {
					"idTagInfo": {
						"status": "Accepted"
						//          "expiryDate": "",
						//          "parentIdTag": ""
					}
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("Authorize", error);
			return {
				"authorizeResponse": {
					"idTagInfo": {
						"status": "Invalid"
						//          "expiryDate": "",
						//          "parentIdTag": ""
					}
				}
			};
		}
	}

	async handleDiagnosticsStatusNotification(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Set date
			args.timestamp = new Date();
			// Save
			await chargingStation.handleDiagnosticsStatusNotification(args);
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDiagnosticsStatusNotification",
				action: "DiagnosticsStatusNotification", message: `Diagnostics Status Notification has been received`,
				detailedMessages: args });
			// Return
			return {
				"diagnosticsStatusNotificationResponse": {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("DiagnosticsStatusNotification", error);
			return {
				"diagnosticsStatusNotificationResponse": {
				}
			};
		}
	}

	async handleFirmwareStatusNotification(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Set date
			args.timestamp = new Date();
			// Save
			await chargingStation.handleFirmwareStatusNotification(args);
			// Log
			Logging.logDebug({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleFirmwareStatusNotification",
				action: "FirmwareStatusNotification", message: `Firmware Status Notification has been received`,
				detailedMessages: args });
			// Return
			return {
				"firmwareStatusNotificationResponse": {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("FirmwareStatusNotification", error);
			return {
				"firmwareStatusNotificationResponse": {
				}
			};
		}
	}

	async handleStartTransaction(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Save
			let transaction = await chargingStation.handleStartTransaction(args);
			// Log
			if (transaction.user) {
				Logging.logInfo({
					source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStartTransaction",
					action: "StartTransaction", user: transaction.user,
					message: `Transaction ID '${transaction.id}' has been started on Connector '${transaction.connectorId}'`,
					detailedMessages: args });
			} else {
				Logging.logInfo({
					source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStartTransaction",
					action: "StartTransaction", message: `Transaction ID '${transaction.id}' has been started by an anonymous user on Connector '${transaction.connectorId}'`,
					detailedMessages: args });
			}
			// Return
			return {
				"startTransactionResponse": {
					"transactionId": transaction.id,
					"idTagInfo": {
						"status": "Accepted"
					}
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("StartTransaction", error);
			return {
				"startTransactionResponse": {
					"transactionId": 0,
					"idTagInfo": {
						"status": "Invalid"
					}
				}
			};
		}
	}

	async handleDataTransfer(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Save
			await chargingStation.handleDataTransfer(args);
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleDataTransfer",
				action: "DataTransfer", message: `Data Transfer has been received`,
				detailedMessages: args });
			// Return
			return {
				"dataTransferResponse": {
					"status": "Accepted"
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("DataTransfer", error);
			return {
				"dataTransferResponse": {
					"status": "Rejected"
				}
			};
		}
	}

	async handleStopTransaction(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Save
			await chargingStation.handleStopTransaction(args);
			// Log
			Logging.logInfo({
				source: headers.chargeBoxIdentity, module: "CentralSystemServer", method: "handleStopTransaction",
				action: "StopTransaction", user: transaction.stop.user, actionOnUser: transaction.user,
				message: `Transaction ID '${transaction.id}' has been stopped`,
				detailedMessages: args });
			// Success
			return {
				"stopTransactionResponse": {
					"idTagInfo": {
						"status": "Accepted"
					}
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("StopTransaction", error);
			// Error
			return {
				"stopTransactionResponse": {
					"idTagInfo": {
						"status": "Invalid"
					}
				}
			};
		}
	}
}

module.exports = CentralSystemServer;
