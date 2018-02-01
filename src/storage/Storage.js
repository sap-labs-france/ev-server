require('source-map-support').install();

class Storage {
	constructor(dbConfig) {
		if (new.target === Storage) {
			throw new TypeError("Cannot construct Storage instances directly");
		}
	}

	start() {
	}

	getEndUserLicenseAgreement(language="en") {
	}

	setCentralRestServer(centralRestServer) {
	}

	getConfigurationParamValue(chargeBoxIdentity, paramName) {
	}

	getLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs, sortDate) {
	}

	saveLog(log) {
	}

	deleteLogs(deleteUpToDate) {
	}

	deleteSecurityLogs(deleteUpToDate) {
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

	getTransactionYears() {
	}

	deleteTransaction(transaction) {
	}

	getMigrations() {
	}

	saveMigration(migration) {
	}

	saveMeterValues(meterValues) {
	}

	getTransactions(searchValue=null, filter={}, withPicture=false, numberOfTransactions=500) {
	}

	getTransaction(transactionId, withPicture=true) {
	}

	saveChargingStation(chargingStation) {
	}

	saveChargingStationConnector(chargingStation, connectorId) {
	}

	saveChargingStationHeartBeat(chargingStation) {
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

	getCompanies(searchValue, numberOfCompanies, withLogo=false) {
	}

	getCompany(id) {
	}

	saveCompany(company) {
	}

	getSites(searchValue, numberOfSite, withPicture=false) {
	}

	saveSite(site) {
	}

	deleteSite(id) {
	}

	getSite(id) {
	}

	getSiteArea(id) {
	}

	saveSiteArea(siteArea) {
	}

	deleteSiteArea(id) {
	}

	getUserByEmail(email) {
	}

	getUserByTagId(tagID) {
	}
}

module.exports=Storage;
