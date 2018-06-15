const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../utils/Authorizations');
const Utils = require('../../../../utils/Utils');
const Users = require('../../../../utils/Users');
const UtilsSecurity = require('./UtilsSecurity');

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
		UtilsSecurity.filterLimit(request, filteredRequest);
		return filteredRequest;
	}

	// Transaction
	static filterTransactionResponse(transaction, loggedUser, withConnector=false) {
		let filteredTransaction;

		if (!transaction) {
			return null;
		}
		// Check auth
		if (Authorizations.canReadTransaction(loggedUser, transaction)) {
			// Set only necessary info
			filteredTransaction = {};
			filteredTransaction.id = transaction.id;
			filteredTransaction.transactionId = transaction.transactionId;
			filteredTransaction.connectorId = transaction.connectorId;
			// Check auth
			if (Authorizations.canReadUser(loggedUser, transaction.user)) {
				// Demo user?
				if (Authorizations.isDemo(loggedUser)) {
					filteredTransaction.tagID = Users.ANONIMIZED_VALUE;
				} else {
					filteredTransaction.tagID = transaction.tagID;
				}
			}
			filteredTransaction.timestamp = transaction.timestamp;
			// Filter user
			filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
				transaction.user, loggedUser);
			// Transaction Stop
			if (transaction.stop) {
				filteredTransaction.stop = {};
				filteredTransaction.stop.timestamp = transaction.stop.timestamp;
				filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
				filteredTransaction.stop.totalInactivitySecs = transaction.stop.totalInactivitySecs;
				// Check auth
				if (transaction.stop.user && Authorizations.canReadUser(loggedUser, transaction.stop.user)) {
					// Demo user?
					if (Authorizations.isDemo(loggedUser)) {
						filteredTransaction.stop.tagID = Users.ANONIMIZED_VALUE;
					} else {
						filteredTransaction.stop.tagID = transaction.stop.tagID;
					}
				}
				// Admin?
				if (Authorizations.isAdmin(loggedUser)) {
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
		if (!Authorizations.canListTransactions(loggedUser)) {
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
		if (Authorizations.canReadUser(loggedUser, user)) {
			// Demo user?
			if (Authorizations.isDemo(loggedUser)) {
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
		if (Authorizations.canReadChargingStation(loggedUser, {"id" : consumption.chargeBoxID})) {
			filteredConsumption.chargeBoxID = consumption.chargeBoxID;
			filteredConsumption.connectorId = consumption.connectorId;
			// Admin?
			if (Authorizations.isAdmin(loggedUser)) {
				filteredConsumption.priceUnit = consumption.priceUnit;
				filteredConsumption.totalPrice = consumption.totalPrice;
			}
			filteredConsumption.totalConsumption = consumption.totalConsumption;
			filteredConsumption.transactionId = consumption.transactionId;
			// Check user
			if (consumption.user) {
				if (!Authorizations.canReadUser(loggedUser, consumption.user)) {
					return null;
				}
			} else {
				if (!Authorizations.isAdmin(loggedUser)) {
					return null;
				}
			}
			// Set user
			filteredConsumption.user = TransactionSecurity._filterUserInTransactionResponse(
				consumption.user, loggedUser);
			// Admin?
			if (Authorizations.isAdmin(loggedUser)) {
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

module.exports = TransactionSecurity;
