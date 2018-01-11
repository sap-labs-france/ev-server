const Logging = require('../../utils/Logging');
const ChargingStationService = require('./service/ChargingStationService');
const UserService = require('./service/UserService');
const PricingService = require('./service/PricingService');
const UtilsService = require('./service/UtilsService');
const LoggingService = require('./service/LoggingService');
const TransactionService = require('./service/TransactionService');
const StatisticService = require('./service/StatisticService');

require('source-map-support').install();

module.exports = {
	// Util Service
	restServiceUtil(req, res, next) {
		// Parse the action
		var action = /^\/\w*/g.exec(req.url)[0].substring(1);
		// Check Context
		switch (req.method) {
			// Create Request
			case "GET":
				// Check Context
				switch (action) {
					// Ping
					case "ping":
						res.sendStatus(200);
						break;
				}
				break;
		}
	},

	restServiceSecured(req, res, next) {
		let filter;
		let filteredRequest;
		// Parse the action
		var action = /^\/\w*/g.exec(req.url)[0].substring(1);
		// Check Context
		switch (req.method) {
			// Create Request
			case "POST":
				// Check Context
				switch (action) {
					// Change max intensity
					case "ChargingStationSetMaxIntensitySocket":
						// Delegate
						ChargingStationService.handleActionSetMaxIntensitySocket(action, req, res, next);
						break;

					// Charge Box
					case "ChargingStationClearCache":
					case "ChargingStationGetConfiguration":
					case "ChargingStationChangeConfiguration":
					case "ChargingStationStopTransaction":
					case "ChargingStationUnlockConnector":
					case "ChargingStationReset":
						// Keep the action (remove ChargingStation)
						action = action.slice(15);
						// Delegate
						ChargingStationService.handleAction(action, req, res, next);
						break;

					// Create User
					case "UserCreate":
						// Delegate
						UserService.handleCreateUser(action, req, res, next);
						break;

					// Unknown Context
					default:
						// Delegate
						UtilsService.handleUnknownAction(action, req, res, next);
				}
				break;

		// Get Request
		case "GET":
			// Check Action
			switch (action) {
				// Get Pricing
				case "Pricing":
					// Delegate
					PricingService.handleGetPricing(action, req, res, next);
					break;

				// Get the Logging
				case "Loggings":
					// Delegate
					LoggingService.handleGetLoggings(action, req, res, next);
					break;

				// Get all the charging stations
				case "ChargingStations":
					// Delegate
					ChargingStationService.handleGetChargingStations(action, req, res, next);
					break;

				// Get one charging station
				case "ChargingStation":
					// Delegate
					ChargingStationService.handleGetChargingStation(action, req, res, next);
					break;

				// Get all the users
				case "Users":
					// Delegate
					UserService.handleGetUsers(action, req, res, next);
					break;

				// Get the user
				case "User":
					// Delegate
					UserService.handleGetUser(action, req, res, next);
					break;

				// Get the completed transactions
				case "TransactionsCompleted":
					// Delegate
					TransactionService.handleGetTransactionsCompleted(action, req, res, next);
					break;

				// Get the transaction's years
				case "TransactionYears":
					// Delegate
					TransactionService.handleGetTransactionYears(action, req, res, next);
					break;

				// Get the consumption statistics
				case "ChargingStationConsumptionStatistics":
					// Delegate
					StatisticService.handleGetChargingStationConsumptionStatistics(action, req, res, next);
					break;

				// Get the consumption statistics
				case "ChargingStationUsageStatistics":
					// Delegate
					StatisticService.handleGetChargingStationUsageStatistics(action, req, res, next);
					break;

				// Get the consumption statistics
				case "UserConsumptionStatistics":
					// Delegate
					StatisticService.handleGetUserConsumptionStatistics(action, req, res, next);
					break;

				// Get the usage statistics
				case "UserUsageStatistics":
					// Delegate
					StatisticService.handleUserUsageStatistics(action, req, res, next);
					break;

				// Get the active transactions
				case "TransactionsActive":
					// Delegate
					TransactionService.handleGetTransactionsActive(action, req, res, next);
					break;

				// Get the transactions
				case "ChargingStationTransactions":
					// Delegate
					TransactionService.handleGetChargingStationTransactions(action, req, res, next);
					break;

				// Get the transaction
				case "Transaction":
					// Delegate
					TransactionService.handleGetTransaction(action, req, res, next);
					break;

				// Get Charging Consumption
				case "ChargingStationConsumptionFromTransaction":
					// Delegate
					TransactionService.handleGetChargingStationConsumptionFromTransaction(action, req, res, next);
					break;

				// Get Charging Configuration
				case "ChargingStationConfiguration":
					// Delegate
					ChargingStationService.handleGetChargingStationConfiguration(action, req, res, next);
					break;

				// Unknown Action
				default:
					// Delegate
					UtilsService.handleUnknownAction(action, req, res, next);
			}
			break;

		// Update Request
		case "PUT":
			// Check
			switch (action) {
				// Change Pricing
				case "PricingUpdate":
					// Delegate
					PricingService.handleUpdatePricing(action, req, res, next);
					break;

				// User
				case "UserUpdate":
					// Delegate
					UserService.handleUpdateUser(action, req, res, next);
					break;

				// Transaction
				case "TransactionSoftStop":
					// Delegate
					TransactionService.handleTransactionSoftStop(action, req, res, next);
					break;

				// Not found
				default:
					// Delegate
					UtilsService.handleUnknownAction(action, req, res, next);
			}
			break;

			// Delete Request
			case "DELETE":
				// Check
				switch (action) {
					// User
					case "UserDelete":
						// Delegate
						UserService.handleDeleteUser(action, req, res, next);
						break;

					// Charging station
					case "ChargingStationDelete":
						// Delegate
						ChargingStationService.handleDeleteChargingStation(action, req, res, next);
						break;

					// Transaction
					case "TransactionDelete":
						// Delegate
						TransactionService.handleDeleteTransaction(action, req, res, next);
						break;

					// Not found
					default:
						// Delegate
						UtilsService.handleUnknownAction(action, req, res, next);
				}
				break;

		default:
			// Log
			Logging.logActionExceptionMessageAndSendResponse(
				"N/A", new Error(`Ussuported request method ${req.method}`), req, res, next);
			break;
		}
	}
};
