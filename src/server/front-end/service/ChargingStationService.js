const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Users = require('../../../utils/Users');

class ChargingStationService {
	static handleGetChargingStationConfiguration(action, req, res, next) {
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationConfigurationRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ChargeBoxIdentity) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Get the Charging Station`
		global.storage.getChargingStation(filteredRequest.ChargeBoxIdentity).then((chargingStation) => {
			let configuration = {};
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_CHARGING_STATION, chargingStation.getChargeBoxIdentity(),
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Get the Config
			chargingStation.getConfiguration().then((configuration) => {
				// Return the result
				res.json(configuration);
				next();
			});
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleDeleteChargingStation(action, req, res, next) {
		// Filter
		let chargingStation;
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationDeleteRequest(req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The charging station's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getChargingStation(filteredRequest.ID).then((foundChargingStation) => {
			chargingStation = foundChargingStation;
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_CHARGING_STATION, chargingStation.getChargeBoxIdentity(),
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Delete
			return global.storage.deleteChargingStation(filteredRequest.ID);
		}).then(() => {
			// Log
			Logging.logInfo({
				user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
				message: `Charging Station ${chargingStation.getChargeBoxIdentity()} has been deleted successfully`,
				action: action, detailedMessages: chargingStation});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStation(action, req, res, next) {
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ChargeBoxIdentity) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getChargingStation(filteredRequest.ChargeBoxIdentity).then((chargingStation) => {
			if (chargingStation) {
				// Return
				res.json(
					// Filter
					SecurityRestObjectFiltering.filterChargingStationResponse(
						chargingStation.getModel(), req.user)
				);
			} else {
				res.json({});
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStations(action, req, res, next) {
		// Check auth
		if (!CentralRestServerAuthorization.canListChargingStations(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_LIST, CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS, null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationsRequest(req.query, req.user);
		let chargingStations;
		// Get the charging stfoundChargingStationsations
		global.storage.getChargingStations(filteredRequest.Search, 100).then((foundChargingStations) => {
			// Set
			chargingStations = foundChargingStations;
			// Get logged user
			return global.storage.getUser(req.user.id);
		}).then((user) => {
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(`The user with ID ${filteredRequest.id} does not exist`,
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Get the user's active transactions
			return user.getTransactions({stop: {$exists: false}}, Users.WITH_NO_IMAGE);
		}).then((activeTransactions) => {
			// Handle
			var chargingStationsJSon = [];
			chargingStations.forEach((chargingStation) => {
				// Check
				let connectors = chargingStation.getConnectors();
				// Set charging station active?
				activeTransactions.forEach(activeTransaction => {
					// Find a match
					if (chargingStation.getChargeBoxIdentity() === activeTransaction.chargeBoxID.chargeBoxIdentity ) {
						// Set
						connectors[activeTransaction.connectorId.valueOf()-1].activeForUser = true;
					}
				});
				// Check the connector?
				if (filteredRequest.OnlyActive === "true") {
					// Remove the connector
					for (let j = connectors.length-1; j >= 0; j--) {
						// Not active?
						if (!connectors[j].activeForUser) {
							// Remove
							connectors.splice(j, 1);
						}
					}
					// Stil some connectors?
					if (connectors.length > 0) {
						// Add
						chargingStationsJSon.push(chargingStation.getModel());
					}
				} else {
					// Add
					chargingStationsJSon.push(chargingStation.getModel());
				}
			});
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterChargingStationsResponse(
					chargingStationsJSon, req.user)
				);
				next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleAction(action, req, res, next) {
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationActionRequest( req.body, action, req.user );
		// Charge Box is mandatory
		if(!filteredRequest.chargeBoxIdentity) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Get the Charging station
		global.storage.getChargingStation(filteredRequest.chargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "CentralRestServerService", "restServiceSecured");
			}
			if (action === "StopTransaction" ||
					action === "UnlockConnector") {
				// Get Transaction
				global.storage.getTransaction(filteredRequest.args.transactionId).then((transaction) => {
					if (transaction) {
						// Add connector ID
						filteredRequest.args.connectorId = transaction.connectorId;
						// Check auth
						if (!CentralRestServerAuthorization.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action, transaction.userID)) {
							// Not Authorized!
							throw new AppAuthError(req.user, action,
								CentralRestServerAuthorization.ENTITY_CHARGING_STATION, chargingStation.getChargeBoxIdentity(),
								500, "CentralRestServerService", "restServiceSecured");
						}
						// Log
						Logging.logInfo({
							user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",  action: action,
							message: `Execute action '${action}' on Charging Station '${filteredRequest.AppAuthErrorchargeBoxIdentity}'`});
						// Execute it
						return chargingStation.handleAction(action, filteredRequest.args);
					} else {
						// Log
						return Promise.reject(new Error(`Transaction ${filteredRequest.TransactionId} does not exist`));
					}
				}).catch((err) => {
					// Log
					Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
				});
			} else {
				// Check auth
				if (!CentralRestServerAuthorization.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action)) {
					// Not Authorized!
					throw new AppAuthError(req.user, action,
						CentralRestServerAuthorization.ENTITY_CHARGING_STATION, chargingStation.getChargeBoxIdentity(),
						500, "CentralRestServerService", "restServiceSecured");
				}
				// Log
				Logging.logInfo({
					user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",  action: action,
					message: `Execute action '${action}' on Charging Station '${filteredRequest.chargeBoxIdentity}'`});
				// Execute it
				return chargingStation.handleAction(action, filteredRequest.args);
			}
		}).then((result) => {
			// Return the result
			res.json(result);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleActionSetMaxIntensitySocket(action, req, res, next) {
		let chargingStation;

		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationSetMaxIntensitySocketRequest( req.body, req.user );
		// Charge Box is mandatory
		if(!filteredRequest.chargeBoxIdentity) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
		}
		// Get the Charging station
		global.storage.getChargingStation(filteredRequest.chargeBoxIdentity).then((foundChargingStation) => {
			// Set
			chargingStation = foundChargingStation;
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), "ChangeConfiguration")) {
				// Not Authorized!
				throw new AppAuthError(req.user, action,
					CentralRestServerAuthorization.ENTITY_CHARGING_STATION, chargingStation.getChargeBoxIdentity(),
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Get the Config
			return chargingStation.getConfiguration();
		}).then((chargerConfiguration) => {
			// Check
			if (!chargerConfiguration) {
				// Not Found!
				throw new AppError(`Cannot retrieve the configuration of the Charging Station ${filteredRequest.chargeBoxIdentity}`,
					500, "CentralRestServerService", "restServiceSecured");
			}

			let maxIntensitySocketMax = null;
			// Fill current params
			for (let i = 0; i < chargerConfiguration.configuration.length; i++) {
				// Max Intensity?
				if (chargerConfiguration.configuration[i].key.startsWith("currentpb")) {
					// Set
					maxIntensitySocketMax = Number(chargerConfiguration.configuration[i].value);
				}
			}
			if (!maxIntensitySocketMax) {
				// Not Found!
				throw new AppError(`Cannot retrieve the max intensity socket from the configuration of the Charging Station ${filteredRequest.chargeBoxIdentity}`,
					500, "CentralRestServerService", "restServiceSecured");
			}
			// Check
			if (filteredRequest.maxIntensity && filteredRequest.maxIntensity >= 0 && filteredRequest.maxIntensity <= maxIntensitySocketMax) {
				// Log
				Logging.logInfo({
					user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured", action: action,
					message: `Change Max Instensity Socket of Charging Station '${filteredRequest.chargeBoxIdentity}' to ${filteredRequest.maxIntensity}`});
				// Change the config
				return chargingStation.requestChangeConfiguration('maxintensitysocket', filteredRequest.maxIntensity);
			} else {
				// Invalid value
				throw new AppError(`Invalid value for param max intensity socket '${filteredRequest.maxIntensity}' for Charging Station ${filteredRequest.chargeBoxIdentity}`,
					500, "CentralRestServerService", "restServiceSecured");
			}
		}).then((result) => {
			// Return the result
			res.json(result);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = ChargingStationService;
