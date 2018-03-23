const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Utils = require('../../../utils/Utils');
const ChargingStations = require('../../../utils/ChargingStations');
const Users = require('../../../utils/Users');
const Constants = require('../../../utils/Constants');
const moment = require('moment');
const UtilsSecurity = require('./UtilsService').UtilsSecurity;

class TransactionService {
	static handleDeleteTransaction(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleDeleteTransaction",
			message: `Delete Transaction ID '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = TransactionSecurity.filterTransactionDelete(req.query, req.user);
		// Transaction Id is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Transaction ID is mandatory`), req, res, next);
			return;
		}
		// Get Transaction
		let transaction;
		let chargingStation;
		let user;
		global.storage.getTransaction(filteredRequest.ID).then((foundTransaction) => {
			transaction = foundTransaction;
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.ID}' does not exist`,
					550, "TransactionService", "handleDeleteTransaction");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_TRANSACTION,
					transaction.id,
					560, "TransactionService", "handleDeleteTransaction",
					req.user);
			}
			// Get the Charging Station
			return global.storage.getChargingStation(transaction.chargeBox.id);
		}).then((foundChargingStation) => {
			chargingStation = foundChargingStation;
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID ${transaction.chargeBox.id} does not exist`,
					550, "TransactionService", "handleDeleteTransaction");
			}
			// Get logged user
			return global.storage.getUser(req.user.id);
		}).then((foundUser) => {
			user = foundUser;
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${req.user.id}' does not exist`,
					550, "TransactionService", "handleDeleteTransaction");
			}
			// Delete Transaction
			return chargingStation.deleteTransaction(transaction);
		}).then((result) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: user.getModel(),
				module: "TransactionService", method: "handleDeleteTransaction",
				message: `Transaction ID '${filteredRequest.ID}' on '${transaction.chargeBox.id}'-'${transaction.connectorId}' has been deleted successfully`,
				action: action, detailedMessages: result});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleTransactionSoftStop(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleTransactionSoftStop",
			message: `Soft Stop Transaction ID '${req.body.transactionId}'`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = TransactionSecurity.filterTransactionSoftStop(req.body, req.user);
		// Transaction Id is mandatory
		if(!filteredRequest.transactionId) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Transaction ID is mandatory`), req, res, next);
			return;
		}
		// Get Transaction
		let transaction, chargingStation, user;
		global.storage.getTransaction(filteredRequest.transactionId).then((foundTransaction) => {
			transaction = foundTransaction;
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.transactionId}' does not exist`,
					550, "TransactionService", "handleTransactionSoftStop");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canUpdateTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_UPDATE,
					CentralRestServerAuthorization.ENTITY_TRANSACTION,
					transaction.id,
					560, "TransactionService", "handleTransactionSoftStop",
					req.user);
			}
			// Get the Charging Station
			return global.storage.getChargingStation(transaction.chargeBox.id);
		}).then((foundChargingStation) => {
			chargingStation = foundChargingStation;
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${transaction.chargeBox.id}' does not exist`,
					550, "TransactionService", "handleTransactionSoftStop");
			}
			// Get logged user
			return global.storage.getUser(req.user.id);
		}).then((foundUser) => {
			user = foundUser;
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${req.user.id}' does not exist`,
					550, "TransactionService", "handleTransactionSoftStop");
			}
			// Stop Transaction
			let stopTransaction = {};
			stopTransaction.transactionId = transaction.id;
			stopTransaction.user = req.user.id;
			stopTransaction.timestamp = new Date().toISOString();
			stopTransaction.meterStop = 0;
			// Save
			return chargingStation.handleStopTransaction(stopTransaction);
		}).then((result) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: (user?user.getModel():null),
				module: "TransactionService", method: "handleTransactionSoftStop",
				message: `Transaction ID '${transaction.id}' on '${transaction.chargeBox.id}'-'${transaction.connectorId}' has been stopped successfully`,
				action: action, detailedMessages: result});
			// Ok
			res.json({status: `Success`});
			next();
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
		let filteredRequest = TransactionSecurity.filterChargingStationConsumptionFromTransactionRequest(req.query, req.user);
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
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.TransactionId}' does not exist`,
					550, "TransactionService", "handleGetChargingStationConsumptionFromTransaction");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_TRANSACTION,
					transaction.id,
					560, "TransactionService", "handleGetChargingStationConsumptionFromTransaction",
					req.user);
			}
			// Get the Charging Station
			return global.storage.getChargingStation(transaction.chargeBox.id);
		}).then((chargingStation) => {
			let consumptions = [];
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.id}' does not exist`,
					550, "TransactionService", "handleGetChargingStationConsumptionFromTransaction");
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
				return chargingStation.getConsumptionsFromTransaction(
					transaction, true);
			} else {
				// Yes: Get the Consumption from dates within the trasaction
				return chargingStation.getConsumptionsFromDateTimeRange(
					transaction, filteredRequest.StartDateTime);
			}
		}).then((consumptions) => {
			// Return the result
			res.json(
				// Filter
				TransactionSecurity.filterConsumptionsFromTransactionResponse(
					consumptions, req.user, true)
			);
			next();
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
			message: `Read Transaction ID '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = TransactionSecurity.filterTransactionRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Transaction ID is mandatory`), req, res, next);
			return;
		}
		// Get Transaction
		global.storage.getTransaction(filteredRequest.ID).then((transaction) => {
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.ID}' does not exist`,
					550, "TransactionService", "handleGetTransaction");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_TRANSACTION,
					transaction.id,
					560, "TransactionService", "handleGetTransaction",
					req.user);
			}
			// Return
			res.json(
				// Filter
				TransactionSecurity.filterTransactionResponse(
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
			message: `Read Transactions from Charging Station '${req.query.ChargeBoxID}'-'${req.query.ConnectorId}'`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListTransactions(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_TRANSACTION,
				null,
				560, "TransactionService", "handleGetChargingStationTransactions",
				req.user);
		}
		// Filter
		let filteredRequest = TransactionSecurity.filterChargingStationTransactionsRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ChargeBoxID) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return;
		}
		// Connector Id is mandatory
		if(!filteredRequest.ConnectorId) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Connector ID is mandatory`), req, res, next);
			return;
		}
		// Get Charge Box
		global.storage.getChargingStation(filteredRequest.ChargeBoxID).then((chargingStation) => {
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`,
					550, "TransactionService", "handleGetChargingStationTransactions");
			}
			// Set the model
			return chargingStation.getTransactions(
				filteredRequest.ConnectorId,
				filteredRequest.StartDateTime,
				filteredRequest.EndDateTime,
				Constants.NO_LIMIT);
		}).then((transactions) => {
			// Return
			res.json(
				// Filter
				TransactionSecurity.filterTransactionsResponse(
					transactions, req.user, ChargingStations.WITH_CONNECTORS)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetTransactionYears(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetTransactionYears",
			message: `Get Transaction's Years`
		});
		// Get Transactions
		global.storage.getTransactionYears().then((transactionsYears) => {
			let result = {};
			if (transactionsYears) {
				result.years = [];
				result.years.push(new Date().getFullYear());
			}
			// Return
			res.json(transactionsYears);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetTransactionsActive(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetTransactionsActive",
			message: `Read Active Transactions`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListTransactions(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_TRANSACTION,
				null,
				560, "TransactionService", "handleGetTransactionsActive",
				req.user);
		}
		let filter = { stop: { $exists: false } };
		// Filter
		let filteredRequest = TransactionSecurity.filterTransactionsActiveRequest(req.query, req.user);
		if (filteredRequest.ChargeBoxID) {
			filter.chargeBoxIdentity = filteredRequest.ChargeBoxID;
		}
		if (filteredRequest.ConnectorId) {
			filter.connectorId = filteredRequest.ConnectorId;
		}
		// Get Transactions
		global.storage.getTransactions(null, filter, null,
				Constants.NO_LIMIT).then((transactions) => {
			// Return
			res.json(
				// Filter
				TransactionSecurity.filterTransactionsResponse(
					transactions, req.user, ChargingStations.WITH_CONNECTORS)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetTransactionsCompleted(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "TransactionService",
			method: "handleGetTransactionsCompleted",
			message: `Read Completed Transactions`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListTransactions(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_TRANSACTION,
				null,
				560, "TransactionService", "handleGetTransactionsCompleted",
				req.user);
		}
		let pricing;
		let filter = {stop: {$exists: true}};
		// Filter
		let filteredRequest = TransactionSecurity.filterTransactionsCompletedRequest(req.query, req.user);
		// Date
		if (filteredRequest.StartDateTime) {
			filter.startDateTime = filteredRequest.StartDateTime;
		}
		if (filteredRequest.EndDateTime) {
			filter.endDateTime = filteredRequest.EndDateTime;
		}
		if (filteredRequest.UserID) {
			filter.userId = filteredRequest.UserID;
		}
		// Read the pricing
		global.storage.getPricing().then((foundPricing) => {
			// Set
			pricing = foundPricing;
			// Check email
			return global.storage.getTransactions(
				filteredRequest.Search,
				filter,
				filteredRequest.SiteID,
				filteredRequest.Limit);
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
				TransactionSecurity.filterTransactionsResponse(
					transactions, req.user, ChargingStations.WITHOUT_CONNECTORS)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

class TransactionSecurity {
	static filterTransactionDelete(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterTransactionSoftStop(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.transactionId = sanitize(request.transactionId);
		return filteredRequest;
	}

	static filterTransactionRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterTransactionsActiveRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
		filteredRequest.ConnectorId = sanitize(request.ConnectorId);
		return filteredRequest;
	}

	static filterTransactionsCompletedRequest(request, loggedUser) {
		let filteredRequest = {};
		// Handle picture
		filteredRequest.StartDateTime = sanitize(request.StartDateTime);
		filteredRequest.EndDateTime = sanitize(request.EndDateTime);
		filteredRequest.SiteID = sanitize(request.SiteID);
		filteredRequest.Search = sanitize(request.Search);
		if (request.UserID) {
			filteredRequest.UserID = sanitize(request.UserID);
		}
		UtilsSecurity._filterLimit(request, filteredRequest);
		return filteredRequest;
	}

	// Transaction
	static filterTransactionResponse(transaction, loggedUser, withConnector=false) {
		let filteredTransaction;

		if (!transaction) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadTransaction(loggedUser, transaction)) {
			// Set only necessary info
			filteredTransaction = {};
			filteredTransaction.id = transaction.id;
			filteredTransaction.transactionId = transaction.transactionId;
			filteredTransaction.connectorId = transaction.connectorId;
			filteredTransaction.timestamp = transaction.timestamp;
			// Filter user
			filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
				transaction.user, loggedUser);
			// Transaction Stop
			if (transaction.stop) {
				filteredTransaction.stop = {};
				filteredTransaction.stop.timestamp = transaction.stop.timestamp;
				filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
				// Admin?
				if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
					filteredTransaction.stop.price = transaction.stop.price;
					filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
				}
				// Stop User
				if (transaction.stop.user) {
					// Filter user
					filteredTransaction.stop.user = TransactionSecurity._filterUserInTransactionResponse(
						transaction.stop.user, loggedUser);
				}
			}
			// Charging Station
			filteredTransaction.chargeBox = {};
			filteredTransaction.chargeBox.id = transaction.chargeBox.id;
			filteredTransaction.chargeBox.chargeBoxID = transaction.chargeBox.chargeBoxID;
			if (withConnector) {
				filteredTransaction.chargeBox.connectors = [];
				filteredTransaction.chargeBox.connectors[transaction.connectorId-1] = transaction.chargeBox.connectors[transaction.connectorId-1];
			}
		}

		return filteredTransaction;
	}

	static filterTransactionsResponse(transactions, loggedUser, withConnector=false) {
		let filteredTransactions = [];

		if (!transactions) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListTransactions(loggedUser)) {
			return null;
		}
		transactions.forEach(transaction => {
			// Filter
			let filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser, withConnector);
			// Ok?
			if (filteredTransaction) {
				// Add
				filteredTransactions.push(filteredTransaction);
			}
		});
		return filteredTransactions;
	}

	static _filterUserInTransactionResponse(user, loggedUser) {
		let userID = {};

		if (!user) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadUser(loggedUser, user)) {
			// Demo user?
			if (CentralRestServerAuthorization.isDemo(loggedUser)) {
				userID.id = null;
				userID.name = Users.ANONIMIZED_VALUE;
				userID.firstName = Users.ANONIMIZED_VALUE;
			} else {
				userID.id = user.id;
				userID.name = user.name;
				userID.firstName = user.firstName;
			}
		}
		return userID;
	}

	static filterChargingStationConsumptionFromTransactionRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.TransactionId = sanitize(request.TransactionId);
		filteredRequest.StartDateTime = sanitize(request.StartDateTime);
		filteredRequest.EndDateTime = sanitize(request.EndDateTime);
		return filteredRequest;
	}

	static filterChargingStationTransactionsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
		filteredRequest.ConnectorId = sanitize(request.ConnectorId);
		filteredRequest.StartDateTime = sanitize(request.StartDateTime);
		filteredRequest.EndDateTime = sanitize(request.EndDateTime);
		return filteredRequest;
	}

	static filterConsumptionsFromTransactionResponse(consumption, loggedUser) {
		let filteredConsumption = {};

		if (!consumption) {
			return null;
		}
		// Check
		if (CentralRestServerAuthorization.canReadChargingStation(loggedUser, consumption.chargeBoxID)) {
			filteredConsumption.chargeBoxID = consumption.chargeBoxID;
			filteredConsumption.connectorId = consumption.connectorId;
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				filteredConsumption.priceUnit = consumption.priceUnit;
				filteredConsumption.totalPrice = consumption.totalPrice;
			}
			filteredConsumption.totalConsumption = consumption.totalConsumption;
			filteredConsumption.transactionId = consumption.transactionId;
			// Check user
			if (consumption.user) {
				if (!CentralRestServerAuthorization.canReadUser(loggedUser, consumption.user)) {
					return null;
				}
			} else {
				if (!CentralRestServerAuthorization.isAdmin(loggedUser)) {
					return null;
				}
			}
			// Set user
			filteredConsumption.user = TransactionSecurity._filterUserInTransactionResponse(
				consumption.user, loggedUser);
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Set them all
				filteredConsumption.values = consumption.values;
			} else {
				// Clean
				filteredConsumption.values = [];
				consumption.values.forEach((value) => {
					// Set
					filteredConsumption.values.push({
						date: value.date,
						value: value.value,
						cumulated: value.cumulated
					});
				});
			}
		}

		return filteredConsumption;
	}
}

module.exports = {
	"TransactionService": TransactionService,
	"TransactionSecurity": TransactionSecurity
};
