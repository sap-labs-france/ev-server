const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Utils = require('../../../utils/Utils');
const ChargingStations = require('../../../utils/ChargingStations');
const Users = require('../../../utils/Users');
const moment = require('moment');

class TransactionService {

	static handleTransactionSoftStop(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetTransactionSoftStop",
			message: `Soft Stop Transaction ID '${req.body.transactionId}'`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterTransactionSoftStop(req.body, req.user);
		// Transaction Id is mandatory
		if(!filteredRequest.transactionId) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Transaction ID is mandatory`), req, res, next);
			return;
		}
		// Get Transaction
		let transaction;
		let chargingStation;
		global.storage.getTransaction(filteredRequest.transactionId).then((foundTransaction) => {
			transaction = foundTransaction;
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(`Transaction ${filteredRequest.transactionId} does not exist`,
					500, "TransactionService", "handleTransactionSoftStop");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadUser(req.user, transaction.userID)) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_USER,
					transaction.userID, 500, "TransactionService", "handleTransactionSoftStop");
			}
			// Get the Charging Station
			return global.storage.getChargingStation(transaction.chargeBoxID.chargeBoxIdentity);
		}).then((foundChargingStation) => {
			chargingStation = foundChargingStation;
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "TransactionService", "handleTransactionSoftStop");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ, CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
					chargingStation.getChargeBoxIdentity(), 500, "TransactionService", "handleTransactionSoftStop");
			}
			// Get logged user
			return global.storage.getUser(req.user.id);
		}).then((user) => {
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(`The user with ID ${req.user.id} does not exist`,
					500, "TransactionService", "handleTransactionSoftStop");
			}
			// Stop Transaction
			let stopTransaction = {};
			stopTransaction.transactionId = transaction.transactionId;
			stopTransaction.userID = req.user.id;
			stopTransaction.timestamp = new Date().toISOString();
			stopTransaction.meterStop = 0;
			// Save
			chargingStation.saveStopTransaction(stopTransaction).then(() => {
				// Log
				Logging.logSecurityInfo({
					user: req.user, module: "TransactionService", method: "handleTransactionSoftStop",
					message: `User '${Utils.buildUserFullName(user.getModel())}' has stopped transaction on Charging Station '${transaction.chargeBoxID.chargeBoxIdentity}'-'${transaction.connectorId}' used by User '${Utils.buildUserFullName(transaction.userID)}' successfully`,
					action: action, detailedMessages: user});
				// Ok
				res.json({status: `Success`});
				next();
			});
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationConsumptionFromTransaction(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetChargingStationConsumptionFromTransaction",
			message: `Read Consumption from Transaction ID '${req.query.TransactionId}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationConsumptionFromTransactionRequest(req.query, req.user);
		// Transaction Id is mandatory
		if(!filteredRequest.TransactionId) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Transaction ID is mandatory`), req, res, next);
			return;
		}
		// Get Transaction
		let transaction;
		global.storage.getTransaction(filteredRequest.TransactionId).then((foundTransaction) => {
			transaction = foundTransaction;
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(`Transaction ${filteredRequest.TransactionId} does not exist`,
					500, "TransactionService", "handleGetChargingStationConsumptionFromTransaction");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadUser(req.user, transaction.userID)) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_USER,
					transaction.userID, 500, "TransactionService", "handleGetChargingStationConsumptionFromTransaction");
			}
			// Get the Charging Station
			return global.storage.getChargingStation(transaction.chargeBoxID.chargeBoxIdentity);
		}).then((chargingStation) => {
			let consumptions = [];
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "TransactionService", "handleGetChargingStationConsumptionFromTransaction");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ, CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
					chargingStation.getChargeBoxIdentity(), 500, "TransactionService", "handleGetChargingStationConsumptionFromTransaction");
			}
			// Check dates
			if (filteredRequest.StartDateTime) {
				// Check date is in the transaction
				if (!moment(filteredRequest.StartDateTime).isSame(moment(transaction.timestamp)) &&
						moment(filteredRequest.StartDateTime).isBefore(moment(transaction.timestamp))) {
					Logging.logActionExceptionMessageAndSendResponse(
						action, new Error(`The requested Start Date ${filteredRequest.StartDateTime} is before the transaction ID ${filteredRequest.TransactionId} Start Date ${transaction.timestamp}`), req, res, next);
					return;
				}
				// Check date is in the transaction
				if (transaction.stop &&
						!moment(filteredRequest.StartDateTime).isSame(moment(transaction.stop.timestamp)) &&
						moment(filteredRequest.StartDateTime).isAfter(moment(transaction.stop.timestamp))) {
					Logging.logActionExceptionMessageAndSendResponse(
						action, new Error(`The requested Start Date ${filteredRequest.StartDateTime} is after the transaction ID ${filteredRequest.TransactionId} Stop Date ${transaction.stop.timestamp}`), req, res, next);
					return;
				}
			}
			// Dates provided?
			if(!filteredRequest.StartDateTime && !filteredRequest.EndDateTime) {
				// No: Get the Consumption from the transaction
				chargingStation.getConsumptionsFromTransaction(
						transaction, true).then((consumptions) => {
					// Return the result
					res.json(
						// Filter
						SecurityRestObjectFiltering.filterConsumptionsFromTransactionResponse(
							consumptions, req.user)
					);
					next();
				});
			} else {
				// Yes: Get the Consumption from dates within the trasaction
				chargingStation.getConsumptionsFromDateTimeRange(
						transaction, filteredRequest.StartDateTime).then((consumptions) => {
					// Return the result
					res.json(
						// Filter
						SecurityRestObjectFiltering.filterConsumptionsFromTransactionResponse(
							consumptions, req.user, true)
					);
					next();
				});
			}
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetTransaction(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetTransaction",
			message: `Read Transaction ID '${req.query.TransactionId}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterTransactionRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.TransactionId) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Transaction ID is mandatory`), req, res, next);
			return;
		}
		// Get Transaction
		global.storage.getTransaction(filteredRequest.TransactionId).then((transaction) => {
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(`Transaction ${filteredRequest.TransactionId} does not exist`,
					500, "TransactionService", "handleGetTransaction");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadUser(req.user, transaction.userID)) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_USER,
					transaction.userID, 500, "TransactionService", "handleGetTransaction");
			}
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterTransactionResponse(
					transaction, req.user, true)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationTransactions(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetChargingStationTransactions",
			message: `Read Transactions from Charging Station '${req.query.ChargeBoxIdentity}'-'${req.query.ConnectorId}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterChargingStationTransactionsRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ChargeBoxIdentity) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Connector Id is mandatory
		if(!filteredRequest.ConnectorId) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Connector ID is mandatory`), req, res, next);
			return;
		}
		// Get Charge Box
		global.storage.getChargingStation(filteredRequest.ChargeBoxIdentity).then((chargingStation) => {
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "TransactionService", "handleGetChargingStationTransactions");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_CHARGING_STATION, chargingStation.getChargeBoxIdentity(),
					500, "TransactionService", "handleGetChargingStationTransactions");
			}
			// Set the model
			return chargingStation.getTransactions(filteredRequest.ConnectorId,
				filteredRequest.StartDateTime, filteredRequest.EndDateTime,
				Users.WITH_NO_IMAGE);
		}).then((transactions) => {
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterTransactionsResponse(
					transactions, req.user, ChargingStations.WITH_CONNECTORS)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetActiveTransactions(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetActiveTransactions",
			message: `Read Active Transactions`,
			detailedMessages: req.query
		});
		let filter = { stop: { $exists: false } };
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterActiveTransactionsRequest(req.query, req.user);
		if (filteredRequest.ChargeBoxIdentity) {
			filter.chargeBoxIdentity = filteredRequest.ChargeBoxIdentity;
		}
		if (filteredRequest.ConnectorId) {
			filter.connectorId = filteredRequest.ConnectorId;
		}
		// Check email
		global.storage.getTransactions(null, filter, filteredRequest.WithPicture).then((transactions) => {
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterTransactionsResponse(
					transactions, req.user, ChargingStations.WITH_CONNECTORS)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompletedTransactions(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetCompletedTransactions",
			message: `Read Completed Transactions`,
			detailedMessages: req.query
		});
		let pricing;
		let filter = {stop: {$exists: true}};
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterCompletedTransactionsRequest(req.query, req.user);
		// Date
		if (filteredRequest.StartDateTime) {
			filter.startDateTime = filteredRequest.StartDateTime;
		}
		if (filteredRequest.EndDateTime) {
			filter.endDateTime = filteredRequest.EndDateTime;
		}
		// Read the pricing
		global.storage.getPricing().then((foundPricing) => {
			// Set
			pricing = foundPricing;
			// Check email
			return global.storage.getTransactions(filteredRequest.Search, filter, filteredRequest.WithPicture);
		}).then((transactions) => {
			// Found?``
			if (transactions && pricing) {
				// List the transactions
				transactions.forEach((transaction) => {
					// Compute the price
					transaction.stop.price = (transaction.stop.totalConsumption / 1000) * pricing.priceKWH;
					transaction.stop.priceUnit = pricing.priceUnit;
				});
			}
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterTransactionsResponse(
					transactions, req.user, ChargingStations.WITHOUT_CONNECTORS)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = TransactionService;
