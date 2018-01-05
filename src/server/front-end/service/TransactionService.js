const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Utils = require('../../../utils/Utils');
const ChargingStations = require('../../../utils/ChargingStations');
const Users = require('../../../utils/Users');

class TransactionService {
	static handleGetChargingStationConsumptionFromTransaction(action, req, res, next) {
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
					500, "TransactionService", "restServiceSecured");
			}
			// Get the Charging Station
			return global.storage.getChargingStation(transaction.chargeBoxID.chargeBoxIdentity);
		}).then((chargingStation) => {
			let consumptions = [];
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(`Charging Station with ID ${filteredRequest.chargeBoxIdentity} does not exist`,
					500, "TransactionService", "restServiceSecured");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_READ, CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
					chargingStation.getChargeBoxIdentity(), 500, "TransactionService", "restServiceSecured");
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
					500, "TransactionService", "restServiceSecured");
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
					500, "TransactionService", "restServiceSecured");
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
