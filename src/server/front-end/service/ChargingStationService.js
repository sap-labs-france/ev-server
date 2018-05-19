const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Users = require('../../../utils/Users');
const ChargingStations = require('../../../utils/ChargingStations');
const Authorizations = require('../../../utils/Authorizations');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const SiteArea = require('../../../model/SiteArea');
const ChargingStationSecurity = require('./security/ChargingStationSecurity');

class ChargingStationService {
	static handleUpdateChargingStationURL(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "ChargingStationService",
			method: "handleUpdateChargingStationURL",
			message: `Update URL of Charging Station '${req.body.id}'`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = ChargingStationSecurity.filterChargingStationURLUpdateRequest( req.body, req.user );
		let chargingStation;
		// Check email
		global.storage.getChargingStation(filteredRequest.id).then((foundChargingStation) => {
			chargingStation = foundChargingStation;
			if (!chargingStation) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station with ID '${filteredRequest.id}' does not exist anymore`,
					550, "ChargingStationService", "handleUpdateChargingStationURL");
			}
			if (!Authorizations.canUpdateChargingStation(req.user, chargingStation.getModel())) {
			// Check auth
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Authorizations.ENTITY_CHARGING_STATION,
					site.getID(),
					560, "ChargingStationService", "handleUpdateChargingStationURL",
					req.user);
			}
			// Update Charging Station URL
			chargingStation.setChargingStationURL(filteredRequest.chargingStationURL);
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update timestamp
			chargingStation.setLastChangedBy(loggedUser);
			chargingStation.setLastChangedOn(new Date());
			// Update
			return chargingStation.saveChargingStationURL();
		}).then((updatedChargingStation) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "ChargingStationService", method: "handleUpdateChargingStationURL",
				message: `Charging Station '${updatedChargingStation.getID()}' URL has been updated successfully`,
				action: action, detailedMessages: updatedChargingStation});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationConfiguration(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "ChargingStationService",
			method: "handleGetChargingStationConfiguration",
			message: `Get Configuration from '${req.query.ChargeBoxID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ChargeBoxID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Get the Charging Station`
		global.storage.getChargingStation(filteredRequest.ChargeBoxID).then((chargingStation) => {
			let configuration = {};
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`,
					550, "ChargingStationService", "handleGetChargingStationConfiguration");
			}
			// Check auth
			if (!Authorizations.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Authorizations.ENTITY_CHARGING_STATION,
					chargingStation.getID(),
					560, "ChargingStationService", "handleGetChargingStationConfiguration",
					req.user);
			}
			// Get the Config
			return chargingStation.getConfiguration();
		}).then((configuration) => {
			// Return the result
			res.json(configuration);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleDeleteChargingStation(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "ChargingStationService",
			method: "handleDeleteChargingStation",
			message: `Delete Charging Station '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let chargingStation;
		let filteredRequest = ChargingStationSecurity.filterChargingStationDeleteRequest(req.query, req.user);
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
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.ID}' does not exist`,
					550, "ChargingStationService", "handleDeleteChargingStation");
			}
			// Check auth
			if (!Authorizations.canDeleteChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Authorizations.ENTITY_CHARGING_STATION,
					chargingStation.getID(),
					560, "ChargingStationService", "handleDeleteChargingStation",
					req.user);
			}
			// Remove Site Area
			chargingStation.setSiteArea(null);
			// Delete
			return chargingStation.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "ChargingStationService", method: "handleDeleteChargingStation",
				message: `Charging Station '${chargingStation.getID()}' has been deleted successfully`,
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
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "ChargingStationService",
			method: "handleGetChargingStation",
			message: `Read Charging Station '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getChargingStation(filteredRequest.ID).then((chargingStation) => {
			if (chargingStation) {
				// Return
				res.json(
					// Filter
					ChargingStationSecurity.filterChargingStationResponse(
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
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "ChargingStationService",
			method: "handleGetChargingStations",
			message: `Read All Charging Stations`,
			detailedMessages: req.query
		});
		// Check auth
		if (!Authorizations.canListChargingStations(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Authorizations.ENTITY_CHARGING_STATIONS,
				null,
				560, "ChargingStationService", "handleGetChargingStations",
				req.user);
			return;
		}
		// Filter
		let filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query, req.user);
		// Get the charging stfoundChargingStationsations
		global.storage.getChargingStations(filteredRequest.Search, null, filteredRequest.WithNoSiteArea,
				Constants.NO_LIMIT).then((foundChargingStations) => {
			// Set
			let chargingStations = foundChargingStations;
			let chargingStationsJSon = [];
			chargingStations.forEach((chargingStation) => {
				// Add
				chargingStationsJSon.push(chargingStation.getModel());
			});
			// Return
			res.json(
				// Filter
				ChargingStationSecurity.filterChargingStationsResponse(
					chargingStationsJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleAction(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "ChargingStationService",
			method: "handleAction",
			message: `Execute Action '${action}' on Charging Station '${req.body.chargeBoxID}'`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = ChargingStationSecurity.filterChargingStationActionRequest( req.body, action, req.user );
		// Charge Box is mandatory
		if(!filteredRequest.chargeBoxID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Get the Charging station
		global.storage.getChargingStation(filteredRequest.chargeBoxID).then((chargingStation) => {
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
					550, "ChargingStationService", "handleAction");
			}
			if (action === "StopTransaction" ||
					action === "UnlockConnector") {
				// Get Transaction
				return global.storage.getTransaction(filteredRequest.args.transactionId).then((transaction) => {
					if (transaction) {
						// Add connector ID
						filteredRequest.args.connectorId = transaction.connectorId;
						// Check auth
						if (!Authorizations.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action)) {
							// Not Authorized!
							throw new AppAuthError(action,
								Authorizations.ENTITY_CHARGING_STATION,
								chargingStation.getID(),
								560, "ChargingStationService", "handleAction",
								req.user);
						}
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
				if (!Authorizations.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action)) {
					// Not Authorized!
					throw new AppAuthError(action,
						Authorizations.ENTITY_CHARGING_STATION,
						chargingStation.getID(),
						560, "ChargingStationService", "handleAction",
						req.user);
				}
				// Execute it
				return chargingStation.handleAction(action, filteredRequest.args);
			}
		}).then((result) => {
			Logging.logSecurityInfo({
				user: req.user, action: action,
				module: "ChargingStationService",
				method: "handleAction",
				message: `Action '${action}' has been executed on Charging Station '${req.body.chargeBoxID}'`,
				detailedMessages: result
			});
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

		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "ChargingStationService",
			method: "handleActionSetMaxIntensitySocket",
			message: `Execute Action '${action}' on Charging Station '${req.body.chargeBoxID}'`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = ChargingStationSecurity.filterChargingStationSetMaxIntensitySocketRequest( req.body, req.user );
		// Charge Box is mandatory
		if(!filteredRequest.chargeBoxID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Charging Station ID is mandatory`), req, res, next);
		}
		// Get the Charging station
		global.storage.getChargingStation(filteredRequest.chargeBoxID).then((foundChargingStation) => {
			// Set
			chargingStation = foundChargingStation;
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
					550, "ChargingStationService", "handleActionSetMaxIntensitySocket");
			}
			// Check auth
			if (!Authorizations.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), "ChangeConfiguration")) {
				// Not Authorized!
				throw new AppAuthError(action,
					Authorizations.ENTITY_CHARGING_STATION,
					chargingStation.getID(),
					560, "ChargingStationService", "handleActionSetMaxIntensitySocket",
					req.user);
			}
			// Get the Config
			return chargingStation.getConfiguration();
		}).then((chargerConfiguration) => {
			// Check
			if (!chargerConfiguration) {
				// Not Found!
				throw new AppError(
					chargingStation.getID(),
					`Cannot retrieve the configuration from the Charging Station '${filteredRequest.chargeBoxID}'`,
					550, "ChargingStationService", "handleActionSetMaxIntensitySocket");
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
				throw new AppError(
					chargingStation.getID(),
					`Cannot retrieve the max intensity socket from the configuration from the Charging Station '${filteredRequest.chargeBoxID}'`,
					550, "ChargingStationService", "handleActionSetMaxIntensitySocket");
			}
			// Check
			if (filteredRequest.maxIntensity && filteredRequest.maxIntensity >= 0 && filteredRequest.maxIntensity <= maxIntensitySocketMax) {
				// Log
				Logging.logSecurityInfo({
					user: req.user, module: "ChargingStationService", method: "handleActionSetMaxIntensitySocket", action: action,
					message: `Change Max Instensity Socket from Charging Station '${filteredRequest.chargeBoxID}' has been set to '${filteredRequest.maxIntensity}'`});
				// Change the config
				return chargingStation.requestChangeConfiguration('maxintensitysocket', filteredRequest.maxIntensity);
			} else {
				// Invalid value
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Invalid value for param max intensity socket '${filteredRequest.maxIntensity}' for Charging Station ${filteredRequest.chargeBoxID}`,
					500, "ChargingStationService", "handleActionSetMaxIntensitySocket");
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
