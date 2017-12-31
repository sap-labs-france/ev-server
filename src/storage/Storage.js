require('source-map-support').install();

class Storage {
	constructor(dbConfig) {
		if (new.target === Storage) {
			throw new TypeError("Cannot construct Storage instances directly");
		}
	}

	start() {
	}

	setCentralRestServer(centralRestServer) {
	}

	getConfigurationParamValue(chargeBoxIdentity, paramName) {
	}

	getLogs(dateFrom, level, chargingStation, searchValue, numberOfLogs, sortDate) {
	}

	saveLog(log) {
	}

	deleteLogs(deleteUpToDate) {
	}

	getConfiguration(chargeBoxIdentity) {
	}

	getStatusNotifications(chargeBoxIdentity, connectorId) {
	}

	getPricing() {
	}

	savePricing(pricing) {
	}

	getLastStatusNotification(chargeBoxIdentity, connectorId) {
	}

	getMeterValuesFromTransaction(transactionId) {
	}

	saveBootNotification(bootNotification) {
	}

	saveNotification(notification) {
	}

	getNotifications(sourceId) {
	}

	saveDataTransfer(dataTransfer) {
	}

	saveConfiguration(configuration) {
	}

	saveStatusNotification(statusNotification) {
	}

	saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
	}

	saveFirmwareStatusNotification(firmwareStatusNotification) {
	}

	saveAuthorize(authorize) {
	}

	saveStartTransaction(startTransaction) {
	}

	saveStopTransaction(stopTransaction) {
	}

	getMigrations() {
	}

	saveMigration(migration) {
	}

	saveMeterValues(meterValues) {
	}

	getTransactions(searchValue, filter, withPicture=false) {
	}

	getTransaction(transactionId) {
	}

	saveChargingStation(chargingStation) {
	}

	deleteChargingStation(id) {
	}

	getChargingStations(searchValue) {
	}

	getChargingStation(chargeBoxIdentity) {
	}

	getUsers(searchValue, numberOfUser, withPicture=false) {
	}

	saveUser(user) {
	}

	deleteUser(id) {
	}

	getUser(id) {
	}

	getUserByEmail(email) {
	}

	getUserByTagId(tagID) {
	}
}

module.exports=Storage;
