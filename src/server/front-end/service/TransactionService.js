const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Utils = require('../../../utils/Utils');
const ChargingStations = require('../../../utils/ChargingStations');
const Authorizations = require('../../../utils/Authorizations');
const Users = require('../../../utils/Users');
const Constants = require('../../../utils/Constants');
const moment = require('moment');
const TransactionSecurity = require('./security/TransactionSecurity');
const ClientOAuth2 = require('client-oauth2');
const axios = require('axios');

class TransactionService {
	static handleRefundTransaction(action, req, res, next) {
		// Filter
		let filteredRequest = TransactionSecurity.filterTransactionRefund(req.body, req.user);
		// Transaction Id is mandatory
		if(!filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Transaction ID is mandatory`), req, res, next);
			return;
		}
		// Get Transaction
		let transaction;
		let chargingStation;
		let user;
		global.storage.getTransaction(filteredRequest.id).then((foundTransaction) => {
			transaction = foundTransaction;
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.ID}' does not exist`,
					550, "TransactionService", "handleRefundTransaction");
			}
			// Check auth
			if (!Authorizations.canRefundTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_REFUND_TRANSACTION,
					Authorizations.ENTITY_TRANSACTION,
					transaction.id,
					560, "TransactionService", "handleRefundTransaction",
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
					550, "TransactionService", "handleRefundTransaction");
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
					550, "TransactionService", "handleRefundTransaction");
			}
			// Refund Transaction
			let cloudRevenueAuth = new ClientOAuth2({
			  clientId: 'sb-revenue-cloud!b1122|revenue-cloud!b1532',
			  clientSecret: 'BtuZkWlC/58HmEMoqBCHc0jBoVg=',
			  accessTokenUri: 'https://seed-innovation.authentication.eu10.hana.ondemand.com/oauth/token'
			})
			// Get the token
			return cloudRevenueAuth.credentials.getToken();
		}).then((authResponse) => {
			// Send HTTP request
			return axios.post(
				'https://eu10.revenue.cloud.sap/api/usage-record/v1/usage-records',
				{
					"metricId": "ChargeCurrent",
					"quantity": transaction.stop.totalConsumption / 1000,
					"startedAt": transaction.timestamp,
					"endedAt": transaction.stop.timestamp,
					"userTechnicalId": transaction.tagID
				},
				{
					"headers": {
						"Authorization": "Bearer " + authResponse.accessToken,
						"Content-Type": "application/json"
					}
				}
			);
		}).then((result) => {
			// console.log(result.data); // { id: 'c9fa0882-512a-427b-97ea-a0b3b05a08e4' }
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: transaction.user,
				source: transaction.chargeBox.id,
				module: "TransactionService", method: "handleRefundTransaction",
				message: `Transaction ID '${filteredRequest.id}' has been refunded successfully`,
				action: action, detailedMessages: result.data});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleDeleteTransaction(action, req, res, next) {
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
			if (!Authorizations.canDeleteTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Authorizations.ENTITY_TRANSACTION,
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
			if (!Authorizations.canUpdateTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Authorizations.ENTITY_TRANSACTION,
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
			if (!Authorizations.canReadTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Authorizations.ENTITY_TRANSACTION,
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
			if (!Authorizations.canReadTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Authorizations.ENTITY_TRANSACTION,
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
		// Check auth
		if (!Authorizations.canListTransactions(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Authorizations.ENTITY_TRANSACTION,
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
		// Check auth
		if (!Authorizations.canListTransactions(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Authorizations.ENTITY_TRANSACTION,
				null,
				560, "TransactionService", "handleGetTransactionsActive",
				req.user);
		}
		let filter = { stop: { $exists: false } };
		// Filter
		let filteredRequest = TransactionSecurity.filterTransactionsActiveRequest(req.query, req.user);
		if (filteredRequest.ChargeBoxID) {
			filter.chargeBoxID = filteredRequest.ChargeBoxID;
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
		// Check auth
		if (!Authorizations.canListTransactions(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Authorizations.ENTITY_TRANSACTION,
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

module.exports = TransactionService;
