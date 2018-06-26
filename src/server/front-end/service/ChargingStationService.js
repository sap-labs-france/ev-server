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
	static handleUpdateChargingStationParams(action, req, res, next) {
		// Filter
		let filteredRequest = ChargingStationSecurity.filterChargingStationParamsUpdateRequest( req.body, req.user );
		let chargingStation;
		// Check email
		global.storage.getChargingStation(filteredRequest.id).then((foundChargingStation) => {
			chargingStation = foundChargingStation;
			if (!chargingStation) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station with ID '${filteredRequest.id}' does not exist anymore`,
					550, "ChargingStationService", "handleUpdateChargingStationParams");
			}
			if (!Authorizations.canUpdateChargingStation(req.user, chargingStation.getModel())) {
			// Check auth
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Authorizations.ENTITY_CHARGING_STATION,
					site.getID(),
					560, "ChargingStationService", "handleUpdateChargingStationParams",
					req.user);
			}
			// Update URL
			chargingStation.setChargingStationURL(filteredRequest.chargingStationURL);
			// Update Nb Phase
			chargingStation.setNumberOfConnectedPhase(filteredRequest.numberOfConnectedPhase);
			// Update Power
			return chargingStation.updateConnectorsPower(true);
		}).then(() => {
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update timestamp
			chargingStation.setLastChangedBy(loggedUser);
			chargingStation.setLastChangedOn(new Date());
			// Update
			return chargingStation.save();
		}).then((updatedChargingStation) => {
			// Log
			Logging.logSecurityInfo({
				source: updatedChargingStation.getID(),
				user: req.user, module: "ChargingStationService",
				method: "handleUpdateChargingStationParams",
				message: `Parameters have been updated successfully`,
				action: action, detailedMessages: {
					"numberOfConnectedPhase": updatedChargingStation.getNumberOfConnectedPhase(),
					"chargingStationURL": updatedChargingStation.getChargingStationURL()
				}});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationConfiguration(action, req, res, next) {
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

	static async handleAction(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationActionRequest( req.body, action, req.user );
			// Charge Box is mandatory
			if(!filteredRequest.chargeBoxID) {
				Logging.logActionExceptionMessageAndSendResponse(
					action, new Error(`The Charging Station ID is mandatory`), req, res, next);
				return;
			}
			// Get the Charging station
			let chargingStation = await global.storage.getChargingStation(filteredRequest.chargeBoxID);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
					550, "ChargingStationService", "handleAction");
			}
			let result;
			if (action === "StopTransaction" ||
					action === "UnlockConnector") {
				// Get Transaction
				let transaction = await global.storage.getTransaction(filteredRequest.args.transactionId);
				if (!transaction) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`Transaction ${filteredRequest.TransactionId} does not exist`,
						560, "ChargingStationService", "handleAction");
				}
				// Add connector ID
				filteredRequest.args.connectorId = transaction.connectorId;
				// Check if user is authorized
				await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(action, chargingStation, transaction.tagID, req.user.tagIDs[0]);
				// Set the tag ID to handle the Stop Transaction afterwards
				transaction.remotestop = {};
				transaction.remotestop.tagID = req.user.tagIDs[0];
				transaction.remotestop.timestamp = new Date().toISOString();
				// Save Transaction
				await global.storage.saveTransaction(transaction);
				// Ok: Execute it
				result = await chargingStation.handleAction(action, filteredRequest.args);
			} else if (action === "StartTransaction") {
				// Check if user is authorized
				await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(action, chargingStation, filteredRequest.args.tagID);
				// Ok: Execute it
				result = await chargingStation.handleAction(action, filteredRequest.args);
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
				result = await chargingStation.handleAction(action, filteredRequest.args);
			}
			// Ok
			Logging.logSecurityInfo({
				source: chargingStation.getID(), user: req.user, action: action,
				module: "ChargingStationService", method: "handleAction",
				message: `'${action}' has been executed successfully`,
				detailedMessages: result });
			// Return the result
			res.json(result);
			next();
		} catch(err) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		}
	}

	static handleActionSetMaxIntensitySocket(action, req, res, next) {
		let chargingStation;
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
					`Cannot retrieve the configuration`,
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
					`Cannot retrieve the max intensity socket from the configuration`,
					550, "ChargingStationService", "handleActionSetMaxIntensitySocket");
			}
			// Check
			if (filteredRequest.maxIntensity && filteredRequest.maxIntensity >= 0 && filteredRequest.maxIntensity <= maxIntensitySocketMax) {
				// Log
				Logging.logSecurityInfo({
					user: req.user, module: "ChargingStationService", method: "handleActionSetMaxIntensitySocket",
					action: action, source: chargingStation.getID(),
					message: `Max Instensity Socket has been set to '${filteredRequest.maxIntensity}'`});
				// Change the config
				return chargingStation.requestChangeConfiguration('maxintensitysocket', filteredRequest.maxIntensity);
			} else {
				// Invalid value
				throw new AppError(
					chargingStation.getID(),
					`Invalid value for Max Intensity Socket: '${filteredRequest.maxIntensity}'`,
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
