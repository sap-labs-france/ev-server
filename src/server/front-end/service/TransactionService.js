const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const moment = require('moment');
const TransactionSecurity = require('./security/TransactionSecurity');
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage');
const PricingStorage = require('../../../storage/mongodb/PricingStorage');
const ChargingStation = require('../../../entity/ChargingStation');
const User = require('../../../entity/User');

class TransactionService {
	static async handleRefundTransaction(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = TransactionSecurity.filterTransactionRefund(req.body, req.user);
			// Transaction Id is mandatory
			if(!filteredRequest.id) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,c
					`The Transaction's ID must be provided`, 500,
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Get Transaction
			let transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.id);
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.ID}' does not exist`, 550,
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Check auth
			if (!Authorizations.canRefundTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_REFUND_TRANSACTION,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleRefundTransaction',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, transaction.chargeBox.id);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID ${transaction.chargeBox.id} does not exist`, 550,
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Get Transaction User
			let user = await User.getUser(req.user.tenantID, transaction.userID);
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${req.user.id}' does not exist`, 550,
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Transfer it to the Revenue Cloud
			await Utils.pushTransactionToRevenueCloud(action, transaction, req.user, transaction.user);
			// Ok
			res.json(Constants.REST_RESPONSE_SUCCESS);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleDeleteTransaction(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = TransactionSecurity.filterTransactionDelete(req.query, req.user);
			// Transaction Id is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Transaction's ID must be provided`, 500,
					'TransactionService', 'handleDeleteTransaction', req.user);
			}
			// Get Transaction
			let transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID);
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.ID}' does not exist`, 550,
					'TransactionService', 'handleDeleteTransaction', req.user);
			}
			// Check auth
			if (!Authorizations.canDeleteTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_DELETE,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleDeleteTransaction',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, transaction.chargeBox.id);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID ${transaction.chargeBox.id} does not exist`, 550,
					'TransactionService', 'handleDeleteTransaction', req.user);
			}
			// Get Transaction User
			let user;
			if (transaction.userID) {
				// Check
				user = await User.getUser(req.user.tenantID, transaction.userID);
				// Check
				if (!user) {
					// Not Found!
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The user with ID '${req.user.id}' does not exist`, 550,
						'TransactionService', 'handleDeleteTransaction', req.user);
				}
			}
			// Delete Transaction
			let result = await chargingStation.deleteTransaction(transaction);
			// Log
			Logging.logSecurityInfo({
              tenantID: req.user.tenantID,
				user: req.user, actionOnUser: (user ? user.getModel() : null),
				module: 'TransactionService', method: 'handleDeleteTransaction',
				message: `Transaction ID '${filteredRequest.ID}' on '${transaction.chargeBox.id}'-'${transaction.connectorId}' has been deleted successfully`,
				action: action, detailedMessages: result});
			// Ok
			res.json(Constants.REST_RESPONSE_SUCCESS);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleTransactionSoftStop(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = TransactionSecurity.filterTransactionSoftStop(req.body, req.user);
			// Transaction Id is mandatory
			if(!filteredRequest.transactionId) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Transaction's ID must be provided`, 500,
					'TransactionService', 'handleTransactionSoftStop', req.user);
			}
			// Get Transaction
			let transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.transactionId);
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.transactionId}' does not exist`, 550,
					'TransactionService', 'handleTransactionSoftStop', req.user);
			}
			// Check auth
			if (!Authorizations.canUpdateTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_UPDATE,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleTransactionSoftStop',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, transaction.chargeBox.id);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${transaction.chargeBox.id}' does not exist`, 550,
					'TransactionService', 'handleTransactionSoftStop', req.user);
			}
			// Check User
			let user;
			if (transaction.userID) {
				// Get Transaction User
				let user = await User.getUser(req.user.tenantID, transaction.userID);
				// Check
				if (!user) {
					// Not Found!
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The user with ID '${req.user.id}' does not exist`, 550,
						'TransactionService', 'handleTransactionSoftStop', req.user);
				}
			}
			// Stop Transaction
			let stopTransaction = {};
			stopTransaction.transactionId = transaction.id;
			stopTransaction.user = req.user.id;
			stopTransaction.timestamp = new Date().toISOString();
			stopTransaction.meterStop = 0;
			// Save
			let result = await chargingStation.handleStopTransaction(stopTransaction);
			// Log
			Logging.logSecurityInfo({
              tenantID: req.user.tenantID,
				user: req.user, actionOnUser: (user?user.getModel():null),
				module: 'TransactionService', method: 'handleTransactionSoftStop',
				message: `Transaction ID '${transaction.id}' on '${transaction.chargeBox.id}'-'${transaction.connectorId}' has been stopped successfully`,
				action: action, detailedMessages: result});
			// Ok
			res.json(Constants.REST_RESPONSE_SUCCESS);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetChargingStationConsumptionFromTransaction(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = TransactionSecurity.filterChargingStationConsumptionFromTransactionRequest(req.query, req.user);
			// Transaction Id is mandatory
			if(!filteredRequest.TransactionId) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Transaction's ID must be provided`, 500,
					'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
			}
			// Get Transaction
			let transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.TransactionId);
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.TransactionId}' does not exist`, 550,
					'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
			}
			// Check auth
			if (!Authorizations.canReadTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_READ,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleGetChargingStationConsumptionFromTransaction',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, transaction.chargeBox.id);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.id}' does not exist`, 550,
					'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
			}
			// Check dates
			if (filteredRequest.StartDateTime) {
				// Check date is in the transaction
				if (!moment(filteredRequest.StartDateTime).isSame(moment(transaction.timestamp)) &&
						moment(filteredRequest.StartDateTime).isBefore(moment(transaction.timestamp))) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The requested Start Date '${new Date(filteredRequest.StartDateTime).toISOString()}' is before the transaction ID '${filteredRequest.TransactionId}' Start Date '${new Date(transaction.timestamp).toISOString()}'`, 500,
						'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
				}
				// Check date is in the transaction
				if (transaction.stop &&
						!moment(filteredRequest.StartDateTime).isSame(moment(transaction.stop.timestamp)) &&
						moment(filteredRequest.StartDateTime).isAfter(moment(transaction.stop.timestamp))) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The requested Start Date '${new Date(filteredRequest.StartDateTime).toISOString()}' is after the transaction ID '${filteredRequest.TransactionId}' Stop Date '${new Date(transaction.stop.timestamp).toISOString()}'`, 500,
						'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
				}
			}
			// Dates provided?
			let consumptions;
			if(!filteredRequest.StartDateTime && !filteredRequest.EndDateTime) {
				// No: Get the Consumption from the transaction
				consumptions = await chargingStation.getConsumptionsFromTransaction(transaction);
			} else {
				// Yes: Get the Consumption from dates within the transaction
				consumptions = await chargingStation.getConsumptionsFromDateTimeRange(transaction, filteredRequest.StartDateTime);
			}
			// Return the result
			res.json(
				// Filter
				TransactionSecurity.filterConsumptionsFromTransactionResponse(
					consumptions, req.user, true)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetTransaction(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = TransactionSecurity.filterTransactionRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Transaction's ID must be provided`, 500,
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Get Transaction
			let transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID);
			// Found?
			if (!transaction) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Transaction '${filteredRequest.ID}' does not exist`, 550,
					'TransactionService', 'handleGetTransaction', req.user);
			}
			// Check auth
			if (!Authorizations.canReadTransaction(req.user, transaction)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_READ,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560,
					'TransactionService', 'handleGetTransaction',
					req.user);
			}
			// Return
			res.json(
				// Filter
				TransactionSecurity.filterTransactionResponse(
					transaction, req.user, true)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetChargingStationTransactions(action, req, res, next) {
		try {
				// Check auth
			if (!Authorizations.canListTransactions(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_LIST,
					Constants.ENTITY_TRANSACTION,
					null,
					560,
					'TransactionService', 'handleGetChargingStationTransactions',
					req.user);
			}
			// Filter
			let filteredRequest = TransactionSecurity.filterChargingStationTransactionsRequest(req.user.tenantID, req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ChargeBoxID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station's ID must be provided`, 500,
					'TransactionService', 'handleGetChargingStationTransactions', req.user);
			}
			// Connector Id is mandatory
			if(!filteredRequest.ConnectorId) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Connector's ID must be provided`, 500,
					'TransactionService', 'handleGetChargingStationTransactions', req.user);
			}
			// Get Charge Box
			let chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`, 550,
					'TransactionService', 'handleGetChargingStationTransactions', req.user);
			}
			// Set the model
			let transactions = await chargingStation.getTransactions(
				filteredRequest.ConnectorId,
				filteredRequest.StartDateTime,
				filteredRequest.EndDateTime,
				true);
			// Filter
			transactions.result = TransactionSecurity.filterTransactionsResponse(
				transactions.result, req.user, Constants.WITH_CONNECTORS);
			// Return
			res.json(transactions);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetTransactionYears(action, req, res, next) {
		try {
			// Get Transactions
			let transactionsYears = await TransactionStorage.getTransactionYears(req.user.tenant);
			let result = {};
			if (transactionsYears) {
				result.years = [];
				result.years.push(new Date().getFullYear());
			}
			// Return
			res.json(transactionsYears);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetTransactionsActive(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListTransactions(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_LIST,
					Constants.ENTITY_TRANSACTION,
					null,
					560,
					'TransactionService', 'handleGetTransactionsActive',
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
			let transactions = await TransactionStorage.getTransactions(req.user.tenantID,
            { ...filter, 'withChargeBoxes': true },
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Filter
			transactions.result = TransactionSecurity.filterTransactionsResponse(
				transactions.result, req.user, Constants.WITH_CONNECTORS);
			// Return
			res.json(transactions);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetTransactionsCompleted(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListTransactions(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Constants.ACTION_LIST,
					Constants.ENTITY_TRANSACTION,
					null,
					560,
					'TransactionService', 'handleGetTransactionsCompleted',
					req.user);
			}
			let filter = {stop: {$exists: true}};
			// Filter
			let filteredRequest = TransactionSecurity.filterTransactionsCompletedRequest(req.query, req.user);
            if (filteredRequest.ChargeBoxID) {
                filter.chargeBoxID = filteredRequest.ChargeBoxID;
            }
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
			let pricing = await PricingStorage.getPricing(req.user.tenant);
			// Check email
			let transactions = await TransactionStorage.getTransactions(req.user.tenantID,
            { ...filter, 'search': filteredRequest.Search, 'siteID': filteredRequest.SiteID },
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Found?
			if (transactions && pricing) {
				// List the transactions
				for (const transaction of transactions.result) {
					// Compute the price
					transaction.stop.price = (transaction.stop.totalConsumption / 1000) * pricing.priceKWH;
					transaction.stop.priceUnit = pricing.priceUnit;
				}
			}
			// Filter
			transactions.result = TransactionSecurity.filterTransactionsResponse(
				transactions.result, req.user, Constants.WITHOUT_CONNECTORS);
			// Return
			res.json(transactions);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = TransactionService;
