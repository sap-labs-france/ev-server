const mongoose = require('mongoose');
const Storage = require('../Storage');
const Logging = require('../../utils/Logging');
const LoggingStorage = require("./storage/LoggingStorage");
const ChargingStationStorage = require('./storage/ChargingStationStorage');
const PricingStorage = require('./storage/PricingStorage');
const TransactionStorage = require('./storage/TransactionStorage');
const NotificationStorage = require('./storage/NotificationStorage');
const UserStorage = require('./storage/UserStorage');
const SiteStorage = require('./storage/SiteStorage');
const MigrationStorage = require('./storage/MigrationStorage');

require('source-map-support').install();

let _dbConfig;

class MongoDBStorage extends Storage {
	// Create database access
	constructor(dbConfig) {
		super(dbConfig);
		// Keep local
		_dbConfig = dbConfig;
		// Override Promise
		mongoose.Promise = global.Promise;
	}

	start() {
		return new Promise((fulfill, reject) => {
			// Connect
			mongoose.connect(`mongodb://${_dbConfig.user}:${_dbConfig.password}@${_dbConfig.host}:${_dbConfig.port}/${_dbConfig.schema}`,
					{"useMongoClient": true}, (err) => {
				if (err) {
					reject(err);
				} else {
					// Log
					Logging.logInfo({
						module: "MongoDBStorage", method: "start", action: "Startup",
						message: `Connected to MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}' and using schema '${_dbConfig.schema}'` });
					// Ok
					fulfill();
				}
			});
		});
	}

	setCentralRestServer(centralRestServer) {
		// Set
		LoggingStorage.setCentralRestServer(centralRestServer);
		ChargingStationStorage.setCentralRestServer(centralRestServer);
		PricingStorage.setCentralRestServer(centralRestServer);
		TransactionStorage.setCentralRestServer(centralRestServer);
		UserStorage.setCentralRestServer(centralRestServer);
		SiteStorage.setCentralRestServer(centralRestServer);
	}

	getEndUserLicenseAgreement(language="en") {
		// Delegate
		return UserStorage.handleGetEndUserLicenseAgreement(language);
	}

	getConfigurationParamValue(chargeBoxIdentity, paramName) {
		// Delegate
		return ChargingStationStorage.handleGetConfigurationParamValue(chargeBoxIdentity, paramName);
	}

	getLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs, sortDate) {
		// Delegate
		return LoggingStorage.handleGetLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs, sortDate);
	}

	saveLog(log) {
		// Delegate
		return LoggingStorage.handleSaveLog(log);
	}

	deleteLogs(deleteUpToDate) {
		// Delegate
		return LoggingStorage.handleDeleteLogs(deleteUpToDate);
	}

	deleteSecurityLogs(deleteUpToDate) {
		// Delegate
		return LoggingStorage.handleDeleteSecurityLogs(deleteUpToDate);
	}

	getConfiguration(chargeBoxIdentity) {
		// Delegate
		return ChargingStationStorage.handleGetConfiguration(chargeBoxIdentity);
	}

	getTransactionYears() {
		return TransactionStorage.handleGetTransactionYears();
	}

	getPricing() {
		// Delegate
		return PricingStorage.handleGetPricing();
	}

	savePricing(pricing) {
		// Delegate
		return PricingStorage.handleSavePricing(pricing);
	}

	getStatusNotifications(chargeBoxIdentity, connectorId) {
		// Delegate
		return ChargingStationStorage.handleGetStatusNotifications(chargeBoxIdentity, connectorId);
	}

	getLastStatusNotification(chargeBoxIdentity, connectorId) {
		// Delegate
		return ChargingStationStorage.handleGetLastStatusNotification(chargeBoxIdentity, connectorId);
	}

	getMeterValuesFromTransaction(transactionId) {
		// Delegate
		return TransactionStorage.handleGetMeterValuesFromTransaction(transactionId);
	}

	deleteTransaction(transaction) {
		// Delegate
		return TransactionStorage.handleDeleteTransaction(transaction);
	}

	saveBootNotification(bootNotification) {
		// Delegate
		return ChargingStationStorage.handleSaveBootNotification(bootNotification);
	}

	saveNotification(notification) {
		// Delegate
		return NotificationStorage.handleSaveNotification(notification);
	}

	getNotifications(sourceId) {
		// Delegate
		return NotificationStorage.handleGetNotification(sourceId);
	}

	saveDataTransfer(dataTransfer) {
		// Delegate
		return ChargingStationStorage.handleSaveDataTransfer(dataTransfer);
	}

	saveConfiguration(configuration) {
		// Delegate
		return ChargingStationStorage.handleSaveConfiguration(configuration);
	}

	saveStatusNotification(statusNotification) {
		// Delegate
		return ChargingStationStorage.handleSaveStatusNotification(statusNotification);
	}

	saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
		// Delegate
		return ChargingStationStorage.handleSaveDiagnosticsStatusNotification(diagnosticsStatusNotification);
	}

	saveFirmwareStatusNotification(firmwareStatusNotification) {
		// Delegate
		return ChargingStationStorage.handleSaveFirmwareStatusNotification(firmwareStatusNotification);
	}

	saveAuthorize(authorize) {
		// Delegate
		return ChargingStationStorage.handleSaveAuthorize(authorize);
	}

	saveStartTransaction(startTransaction) {
		// Delegate
		return TransactionStorage.handleSaveStartTransaction(startTransaction);
	}

	saveStopTransaction(stopTransaction) {
		// Delegate
		return TransactionStorage.handleSaveStopTransaction(stopTransaction);
	}

	getMigrations() {
		// Delegate
		return MigrationStorage.handleGetMigrations();
	}

	saveMigration(migration) {
		// Delegate
		return MigrationStorage.handleSaveMigrations(migration);
	}

	saveMeterValues(meterValues) {
		// Delegate
		return TransactionStorage.handleSaveMeterValues(meterValues);
	}

	getTransactions(searchValue=null, filter={}, withPicture=false, numberOfTransactions=500) {
		// Delegate
		return TransactionStorage.handleGetTransactions(searchValue, filter, withPicture, numberOfTransactions);
	}

	getTransaction(transactionId, withPicture=true) {
		// Delegate
		return TransactionStorage.handleGetTransaction(transactionId, withPicture);
	}

	saveChargingStationConnector(chargingStation, connectorId) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStationConnector(
			chargingStation, connectorId);
	}

	saveChargingStation(chargingStation) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStation(chargingStation);
	}

	deleteChargingStation(id) {
		// Delegate
		return ChargingStationStorage.handleDeleteChargingStation(id);
	}

	getChargingStations(searchValue) {
		// Delegate
		return ChargingStationStorage.handleGetChargingStations(searchValue);
	}

	getChargingStation(chargeBoxIdentity) {
		// Delegate
		return ChargingStationStorage.handleGetChargingStation(chargeBoxIdentity);
	}

	getUsers(searchValue, numberOfUser, withPicture=false) {
		// Delegate
		return UserStorage.handleGetUsers(searchValue, numberOfUser, withPicture);
	}

	saveUser(user) {
		// Delegate
		return UserStorage.handleSaveUser(user);
	}

	getUser(id) {
		// Delegate
		return UserStorage.handleGetUser(id);
	}

	deleteUser(id) {
		// Delegate
		return UserStorage.handleDeleteUser(id);
	}

	getUserByEmail(email) {
		// Delegate
		return UserStorage.handleGetUserByEmail(email);
	}

	getUserByTagId(tagID) {
		// Delegate
		return UserStorage.handleGetUserByTagId(tagID);
	}

	getSites(searchValue, numberOfSite, withPicture=false) {
		// Delegate
		return SiteStorage.handleGetSites(searchValue, numberOfSite, withPicture);
	}

	saveSite(site) {
		// Delegate
		return SiteStorage.handleSaveSite(site);
	}

	deleteSite(id) {
		// Delegate
		return SiteStorage.handleDeleteSite(id);
	}

	getSite(id) {
		// Delegate
		return SiteStorage.handleGetSite(id);
	}
}

module.exports = MongoDBStorage;
