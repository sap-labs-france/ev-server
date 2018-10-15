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
	constructor(centralSystemConfig, chargingStationConfig, express = null) {
		// Check
		if (new.target === CentralSystemServer) {
			throw new TypeError('Cannot construct CentralSystemServer instances directly');
		}

		if ( express !== null) {
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
		let chargingStation = await ChargingStation.getChargingStation(chargeBoxIdentity);
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

	async handleBootNotification(content) {
		try{
				// Set the endpoint
			content.endpoint = content.From.Address;
			// Set the ChargeBox ID
			content.id = content.chargeBoxIdentity;
			// Set the default Heart Beat
			content.lastReboot = new Date();
			content.lastHeartBeat = content.lastReboot;
			content.timestamp = content.lastReboot;

			// Get the charging station
<<<<<<< HEAD
			let chargingStation = await ChargingStationStorage.getChargingStation(content.chargeBoxIdentity);
=======
			let chargingStation = await ChargingStation.getChargingStation(headers.chargeBoxIdentity);
>>>>>>> 156ac50eeef57b527c17b98d8a221212b8e83e3b
			if (!chargingStation) {
				// Save Charging Station
				chargingStation = new ChargingStation(content);
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
				chargingStation.setChargePointVendor(content.chargePointVendor);
				chargingStation.setChargePointModel(content.chargePointModel);
				chargingStation.setChargePointSerialNumber(content.chargePointSerialNumber);
				chargingStation.setChargeBoxSerialNumber(content.chargeBoxSerialNumber);
				chargingStation.setFirmwareVersion(content.firmwareVersion);
				chargingStation.setOcppVersion(content.ocppVersion);
				chargingStation.setLastHeartBeat(new Date());
				// Back again
				chargingStation.setDeleted(false);
			}
			// Save Charging Station
			let updatedChargingStation = await chargingStation.save();
			// Save the Boot Notification
			await updatedChargingStation.handleBootNotification(content);
			// Return the result
			// OCPP 1.6
			if (content.ocppVersion === '1.6') {
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
			// Set the source
			error.source = headers.chargeBoxIdentity;
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

	async handleHeartbeat(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Save
			await chargingStation.handleHeartBeat();
			// Return			
			return {
				'heartbeatResponse': {
					'currentTime': chargingStation.getLastHeartBeat().toISOString()
				}
			};
		} catch(error) {
			// Set the source
			error.source = headers.chargeBoxIdentity;
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

	async handleStatusNotification(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Handle
			await chargingStation.handleStatusNotification(content);
			// Respond
			return {
				'statusNotificationResponse': {
				}
			};
		} catch(error) {
			// Set the source
			error.source = headers.chargeBoxIdentity;
			// Log error
			Logging.logActionExceptionMessage('StatusNotification', error);
			// Return
			return {
				'statusNotificationResponse': {
				}
			};
		}
	}

	async handleMeterValues(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Save
			await chargingStation.handleMeterValues(content);
			// Return
			return {
				'meterValuesResponse': {
				}
			};
		} catch(error) {
			// Set the source
			error.source = headers.chargeBoxIdentity;
			// Log error
			Logging.logActionExceptionMessage('MeterValues', error);
			// Response
			return {
				'meterValuesResponse': {
				}
			};
		}
	}

	async handleAuthorize(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Handle
			await chargingStation.handleAuthorize(content);
			// Return
			return {
				'authorizeResponse': {
					'idTagInfo': {
						'status': 'Accepted'
					}
				}
			};
		} catch(error) {
			// Set the source
			error.source = headers.chargeBoxIdentity;
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

	async handleDiagnosticsStatusNotification(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Save
			await chargingStation.handleDiagnosticsStatusNotification(content);
			// Return
			return {
				'diagnosticsStatusNotificationResponse': {
				}
			};
		} catch(error) {
			// Set the source
			error.source = headers.chargeBoxIdentity;
			// Log error
			Logging.logActionExceptionMessage('DiagnosticsStatusNotification', error);
			return {
				'diagnosticsStatusNotificationResponse': {
				}
			};
		}
	}

	async handleFirmwareStatusNotification(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Save
			await chargingStation.handleFirmwareStatusNotification(content);
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

	async handleStartTransaction(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Save
			let transaction = await chargingStation.handleStartTransaction(content);
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
			// Set the source
			error.source = headers.chargeBoxIdentity;
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

	async handleDataTransfer(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Save
			await chargingStation.handleDataTransfer(content);
			// Return
			return {
				'dataTransferResponse': {
					'status': 'Accepted'
				}
			};
		} catch(error) {
			// Set the source
			error.source = headers.chargeBoxIdentity;
			// Log error
			Logging.logActionExceptionMessage('DataTransfer', error);
			return {
				'dataTransferResponse': {
					'status': 'Rejected'
				}
			};
		}
	}

	async handleStopTransaction(content) {
		try {
			// Get the charging station
			let chargingStation = await this.checkAndGetChargingStation(content.chargeBoxIdentity);
			// Handle
			await chargingStation.handleStopTransaction(content);
			// Success
			return {
				'stopTransactionResponse': {
					'idTagInfo': {
						'status': 'Accepted'
					}
				}
			};
		} catch(error) {
			// Set the source
			error.source = headers.chargeBoxIdentity;
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
