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

	getLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs=500, sortDate) {
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

	saveChargingStationSiteArea(chargingStation) {
	}

	deleteChargingStation(id) {
	}

	getChargingStations(searchValue, siteAreaID, onlyWithNoSiteArea, numberOfChargingStation=500) {
	}

	getChargingStation(chargeBoxIdentity) {
	}

	getUsers(searchValue, withPicture=false, numberOfUser=500) {
	}

	saveUser(user) {
	}

	deleteUser(id) {
	}

	getUser(id) {
	}

	getCompanies(searchValue, withSites=false, withLogo=false, numberOfCompanies=500) {
	}

	getCompany(id) {
	}

	saveCompany(company) {
	}

	deleteCompany(id) {
	}

	getSitesFromCompany(companyID) {
	}

	getSites(searchValue, withSiteAreas=false, withPicture=false, numberOfSite=500) {
	}

	saveSite(site) {
	}

	deleteSite(id) {
	}

	getSite(id) {
	}

	getSiteAreasFromSite(siteID) {
	}

	getSiteAreas(searchValue, withPicture=false, numberOfSiteArea=500) {
	}

	getSiteArea(id, withChargingStations=false, withSite=false) {
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
