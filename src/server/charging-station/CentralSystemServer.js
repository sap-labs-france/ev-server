const bodyParser = require('body-parser');
const CFLog = require('cf-nodejs-logging-support');
require('body-parser-xml')(bodyParser);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const ChargingStation = require('../../model/ChargingStation');
const AppError = require('../../exception/AppError');
const Logging = require('../../utils/Logging');
const Configuration = require('../../utils/Configuration');
require('source-map-support').install();

let _centralSystemConfig;
let _chargingStationConfig;

class CentralSystemServer {
	// Common constructor for Central System Server
	constructor(centralSystemConfig, chargingStationConfig, express) {
		// Check
		if (new.target === CentralSystemServer) {
			throw new TypeError('Cannot construct CentralSystemServer instances directly');
		}

		// Body parser
		express.use(bodyParser.json());
		express.use(bodyParser.urlencoded({ extended: false }));
		express.use(bodyParser.xml());

		// Enable debug?
		if (centralSystemConfig.debug) {
			// Log
			express.use(
				morgan('combined', {
					'stream': {
						write: (message) => { 
							// Log
							Logging.logDebug({
								module: "CentralSystemServer", method: "constructor", action: "HttpRequestLog",
								message: message
							});
						}
					}
				})
			);
		}

		// Cross origin headers
		express.use(cors());

		// Secure the application
		express.use(helmet());

		// Check Cloud Foundry
		if (Configuration.isCloudFoundry()) {
			// Bind to express app
			express.use(CFLog.logNetwork);
		}
		
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
				`Charging Station does not exist`, 550, 
				'CentralSystemServer', 'checkAndGetChargingStation');
		}
		// Found?
		if (chargingStation.isDeleted()) {
			throw new AppError(
				chargeBoxIdentity,
				`Charging Station is deleted`, 550, 
				'CentralSystemServer', 'checkAndGetChargingStation');
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
			// Return the result
			// OCPP 1.6
			if (args.ocppVersion === '1.6') {
				return {
					'bootNotificationResponse': {
						'status': 'Accepted',
						'currentTime': new Date().toISOString(),
						'interval': _chargingStationConfig.heartbeatIntervalSecs
					}
				};
				// OCPP 1.2 && 1.5
			} else {
				return {
					'bootNotificationResponse': {
						'status': 'Accepted',
						'currentTime': new Date().toISOString(),
						'heartbeatInterval': _chargingStationConfig.heartbeatIntervalSecs
					}
				};
			}
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('BootNotification', error);
			// Reject
			return {
				'bootNotificationResponse': {
					'status': 'Rejected',
					'currentTime': new Date().toISOString(),
					'heartbeatInterval': _chargingStationConfig.heartbeatIntervalSecs
				}
			};
		}
	}

	async handleHeartBeat(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Save
			await chargingStation.handleHeartBeat();
			// Return			
			return {
				'heartbeatResponse': {
					'currentTime': chargingStation.getLastHeartBeat().toISOString()
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('HeartBeat', error);
			// Send the response
			return {
				'heartbeatResponse': {
					'currentTime': new Date().toISOString()
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
			// Respond
			return {
				'statusNotificationResponse': {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('StatusNotification', error);
			// Return
			return {
				'statusNotificationResponse': {
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
			// Return
			return {
				'meterValuesResponse': {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('MeterValues', error);
			// Response
			return {
				'meterValuesResponse': {
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
			// Return
			return {
				'authorizeResponse': {
					'idTagInfo': {
						'status': 'Accepted'
					}
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('Authorize', error);
			return {
				'authorizeResponse': {
					'idTagInfo': {
						'status': 'Invalid'
					}
				}
			};
		}
	}

	async handleDiagnosticsStatusNotification(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Save
			await chargingStation.handleDiagnosticsStatusNotification(args);
			// Return
			return {
				'diagnosticsStatusNotificationResponse': {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('DiagnosticsStatusNotification', error);
			return {
				'diagnosticsStatusNotificationResponse': {
				}
			};
		}
	}

	async handleFirmwareStatusNotification(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Save
			await chargingStation.handleFirmwareStatusNotification(args);
			// Return
			return {
				'firmwareStatusNotificationResponse': {
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('FirmwareStatusNotification', error);
			return {
				'firmwareStatusNotificationResponse': {
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
			// Return
			return {
				'startTransactionResponse': {
					'transactionId': transaction.id,
					'idTagInfo': {
						'status': 'Accepted'
					}
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('StartTransaction', error);
			return {
				'startTransactionResponse': {
					'transactionId': 0,
					'idTagInfo': {
						'status': 'Invalid'
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
			// Return
			return {
				'dataTransferResponse': {
					'status': 'Accepted'
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('DataTransfer', error);
			return {
				'dataTransferResponse': {
					'status': 'Rejected'
				}
			};
		}
	}

	async handleStopTransaction(args, headers, req) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(headers.chargeBoxIdentity);
			// Handle
			await chargingStation.handleStopTransaction(args);
			// Success
			return {
				'stopTransactionResponse': {
					'idTagInfo': {
						'status': 'Accepted'
					}
				}
			};
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage('StopTransaction', error);
			// Error
			return {
				'stopTransactionResponse': {
					'idTagInfo': {
						'status': 'Invalid'
					}
				}
			};
		}
	}
}

module.exports = CentralSystemServer;
