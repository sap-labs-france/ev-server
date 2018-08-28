const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const moment = require('moment');
const TransactionSecurity = require('./security/TransactionSecurity');
const ClientOAuth2 = require('client-oauth2');
const axios = require('axios');
const ChargingStationStorage = require('../../../storage/mongodb/ChargingStationStorage'); 
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage'); 
const UserStorage = require('../../../storage/mongodb/UserStorage'); 
const PricingStorage = require('../../../storage/mongodb/PricingStorage'); 

class TransactionService {
	static async handleRefundTransaction(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = TransactionSecurity.filterTransactionRefund(req.body, req.user);
			// Transaction Id is mandatory
			if(!filteredRequest.id) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Transaction's ID must be provided`, 500, 
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Get Transaction
			let transaction = await TransactionStorage.getTransaction(filteredRequest.id);
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
					Authorizations.ACTION_REFUND_TRANSACTION,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleRefundTransaction',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStationStorage.getChargingStation(transaction.chargeBox.id);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID ${transaction.chargeBox.id} does not exist`, 550, 
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Get Transaction User
			let user = await UserStorage.getUser(transaction.userID);
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${req.user.id}' does not exist`, 550, 
					'TransactionService', 'handleRefundTransaction', req.user);
			}
			// Refund Transaction
			let cloudRevenueAuth = new ClientOAuth2({
			  clientId: 'sb-revenue-cloud!b1122|revenue-cloud!b1532',
			  clientSecret: 'BtuZkWlC/58HmEMoqBCHc0jBoVg=',
			  accessTokenUri: 'https://seed-innovation.authentication.eu10.hana.ondemand.com/oauth/token'
			})
			// Get the token
			let authResponse = await cloudRevenueAuth.credentials.getToken();
			// Send HTTP request
			let result = await axios.post(
				'https://eu10.revenue.cloud.sap/api/usage-record/v1/usage-records',
				{
					'metricId': 'ChargeCurrent_Demo',
					'quantity': transaction.stop.totalConsumption / 1000,
					'startedAt': transaction.timestamp,
					'endedAt': transaction.stop.timestamp,
					'userTechnicalId': transaction.tagID
				},
				{
					'headers': {
						'Authorization': 'Bearer ' + authResponse.accessToken,
						'Content-Type': 'application/json'
					}
				}
			);
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: transaction.user,
				source: transaction.chargeBox.id,
				module: 'TransactionService', method: 'handleRefundTransaction',
				message: `Transaction ID '${filteredRequest.id}' has been refunded successfully`,
				action: action, detailedMessages: result.data});
			// Ok
			res.json({status: `Success`});
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
			let transaction = await TransactionStorage.getTransaction(filteredRequest.ID);
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
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleDeleteTransaction',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStationStorage.getChargingStation(transaction.chargeBox.id);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID ${transaction.chargeBox.id} does not exist`, 550, 
					'TransactionService', 'handleDeleteTransaction', req.user);
			}
			// Get Transaction User
			let user = await UserStorage.getUser(transaction.userID);
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${req.user.id}' does not exist`, 550, 
					'TransactionService', 'handleDeleteTransaction', req.user);
			}
			// Delete Transaction
			let result = await chargingStation.deleteTransaction(transaction);
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: user.getModel(),
				module: 'TransactionService', method: 'handleDeleteTransaction',
				message: `Transaction ID '${filteredRequest.ID}' on '${transaction.chargeBox.id}'-'${transaction.connectorId}' has been deleted successfully`,
				action: action, detailedMessages: result});
			// Ok
			res.json({status: `Success`});
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
			let transaction = await TransactionStorage.getTransaction(filteredRequest.transactionId);
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
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleTransactionSoftStop',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStationStorage.getChargingStation(transaction.chargeBox.id);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${transaction.chargeBox.id}' does not exist`, 550, 
					'TransactionService', 'handleTransactionSoftStop', req.user);
			}
			// Get Transaction User
			let user = await UserStorage.getUser(transaction.userID);
			// Check
			if (!user) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${req.user.id}' does not exist`, 550, 
					'TransactionService', 'handleTransactionSoftStop', req.user);
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
				user: req.user, actionOnUser: (user?user.getModel():null),
				module: 'TransactionService', method: 'handleTransactionSoftStop',
				message: `Transaction ID '${transaction.id}' on '${transaction.chargeBox.id}'-'${transaction.connectorId}' has been stopped successfully`,
				action: action, detailedMessages: result});
			// Ok
			res.json({status: `Success`});
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
			let transaction = await TransactionStorage.getTransaction(filteredRequest.TransactionId);
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
					Authorizations.ACTION_READ,
					Constants.ENTITY_TRANSACTION,
					transaction.id,
					560, 'TransactionService', 'handleGetChargingStationConsumptionFromTransaction',
					req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStationStorage.getChargingStation(transaction.chargeBox.id);
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
						`The requested Start Date ${filteredRequest.StartDateTime} is before the transaction ID ${filteredRequest.TransactionId} Start Date ${transaction.timestamp}`, 500, 
						'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
				}
				// Check date is in the transaction
				if (transaction.stop &&
						!moment(filteredRequest.StartDateTime).isSame(moment(transaction.stop.timestamp)) &&
						moment(filteredRequest.StartDateTime).isAfter(moment(transaction.stop.timestamp))) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The requested Start Date ${filteredRequest.StartDateTime} is after the transaction ID ${filteredRequest.TransactionId} Stop Date ${transaction.stop.timestamp}`, 500, 
						'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
				}
			}
			// Dates provided?
			let consumptions;
			if(!filteredRequest.StartDateTime && !filteredRequest.EndDateTime) {
				// No: Get the Consumption from the transaction
				consumptions = await chargingStation.getConsumptionsFromTransaction(transaction, true);
			} else {
				// Yes: Get the Consumption from dates within the trasaction
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
			let transaction = await TransactionStorage.getTransaction(filteredRequest.ID);
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
					Authorizations.ACTION_READ,
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
					Authorizations.ACTION_LIST,
					Constants.ENTITY_TRANSACTION,
					null,
					560, 
					'TransactionService', 'handleGetChargingStationTransactions',
					req.user);
			}
			// Filter
			let filteredRequest = TransactionSecurity.filterChargingStationTransactionsRequest(req.query, req.user);
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
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.ChargeBoxID);
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
			// Return
			res.json(
				// Filter
				TransactionSecurity.filterTransactionsResponse(
					transactions, req.user, Constants.WITH_CONNECTORS)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetTransactionYears(action, req, res, next) {
		try {
			// Get Transactions
			let transactionsYears = await TransactionStorage.getTransactionYears();
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
					Authorizations.ACTION_LIST,
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
			let transactions = await TransactionStorage.getTransactions(
				{ ...filter, 'withChargeBoxes': true }, 
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Return
			res.json(
				// Filter
				TransactionSecurity.filterTransactionsResponse(
					transactions, req.user, Constants.WITH_CONNECTORS)
			);
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
					Authorizations.ACTION_LIST,
					Constants.ENTITY_TRANSACTION,
					null,
					560, 
					'TransactionService', 'handleGetTransactionsCompleted',
					req.user);
			}
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
			let pricing = await PricingStorage.getPricing();
			// Check email
			let transactions = await TransactionStorage.getTransactions(
				{ ...filter, 'search': filteredRequest.Search, 'siteID': filteredRequest.SiteID },
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
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
					transactions, req.user, Constants.WITHOUT_CONNECTORS)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = TransactionService;
