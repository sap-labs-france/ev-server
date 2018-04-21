const mongoose = require('mongoose');
const Storage = require('../Storage');
const Logging = require('../../utils/Logging');
const LoggingStorage = require("./storage/LoggingStorage");
const ChargingStationStorage = require('./storage/ChargingStationStorage');
const PricingStorage = require('./storage/PricingStorage');
const TransactionStorage = require('./storage/TransactionStorage');
const NotificationStorage = require('./storage/NotificationStorage');
const UserStorage = require('./storage/UserStorage');
const CarStorage = require('./storage/CarStorage');
const CompanyStorage = require('./storage/CompanyStorage');
const SiteStorage = require('./storage/SiteStorage');
const SiteAreaStorage = require('./storage/SiteAreaStorage');
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
		// Set debug?
		if (dbConfig.debug) {
			mongoose.set('debug', true);
		}
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
		CompanyStorage.setCentralRestServer(centralRestServer);
		SiteStorage.setCentralRestServer(centralRestServer);
		SiteAreaStorage.setCentralRestServer(centralRestServer);
		CarStorage.setCentralRestServer(centralRestServer);
	}

	getEndUserLicenseAgreement(language="en") {
		// Delegate
		return UserStorage.handleGetEndUserLicenseAgreement(language);
	}

	getConfigurationParamValue(chargeBoxID, paramName) {
		// Delegate
		return ChargingStationStorage.handleGetConfigurationParamValue(chargeBoxID, paramName);
	}

	getLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs=500, sortDate) {
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

	getConfiguration(chargeBoxID) {
		// Delegate
		return ChargingStationStorage.handleGetConfiguration(chargeBoxID);
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

	getStatusNotifications(chargeBoxID, connectorId) {
		// Delegate
		return ChargingStationStorage.handleGetStatusNotifications(chargeBoxID, connectorId);
	}

	getLastStatusNotification(chargeBoxID, connectorId) {
		// Delegate
		return ChargingStationStorage.handleGetLastStatusNotification(chargeBoxID, connectorId);
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

	getTransactions(searchValue=null, filter={}, siteID=null, numberOfTransactions=500) {
		// Delegate
		return TransactionStorage.handleGetTransactions(searchValue, filter, siteID, numberOfTransactions);
	}

	getActiveTransaction(chargeBoxID, connectorID) {
		// Delegate
		return TransactionStorage.handleGetActiveTransaction(chargeBoxID, connectorID);
	}

	getTransaction(transactionId) {
		// Delegate
		return TransactionStorage.handleGetTransaction(transactionId);
	}

	saveChargingStationConnector(chargingStation, connectorId) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStationConnector(
			chargingStation, connectorId);
	}

	saveChargingStationURL(chargingStation) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStationURL(
			chargingStation);
	}

	saveChargingStationHeartBeat(chargingStation) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStationHeartBeat(
			chargingStation);
	}

	saveChargingStationSiteArea(chargingStation) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStationSiteArea(
			chargingStation);
	}

	saveChargingStation(chargingStation) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStation(chargingStation);
	}

	deleteChargingStation(id) {
		// Delegate
		return ChargingStationStorage.handleDeleteChargingStation(id);
	}

	getChargingStations(searchValue, siteAreaID, withNoSiteArea=false, numberOfChargingStation=500) {
		// Delegate
		return ChargingStationStorage.handleGetChargingStations(searchValue, siteAreaID, withNoSiteArea, numberOfChargingStation);
	}

	getChargingStation(id) {
		// Delegate
		return ChargingStationStorage.handleGetChargingStation(id);
	}

	getUsers(searchValue, companyID, numberOfUser=500) {
		// Delegate
		return UserStorage.handleGetUsers(searchValue, companyID, numberOfUser);
	}

	saveUser(user) {
		// Delegate
		return UserStorage.handleSaveUser(user);
	}

	saveUserImage(user) {
		// Delegate
		return UserStorage.handleSaveUserImage(user);
	}

	getUser(id) {
		// Delegate
		return UserStorage.handleGetUser(id);
	}

	getUserImage(id) {
		// Delegate
		return UserStorage.handleGetUserImage(id);
	}

	getUserImages() {
		// Delegate
		return UserStorage.handleGetUserImages();
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

	getCompanies(searchValue, userID=null, withSites=false, numberOfCompanies=500) {
		// Delegate
		return CompanyStorage.handleGetCompanies(searchValue, userID, withSites, numberOfCompanies);
	}

	getCompany(id, withUsers=false) {
		// Delegate
		return CompanyStorage.handleGetCompany(id, withUsers);
	}

 	getCompanyLogo(id) {
		// Delegate
		return CompanyStorage.handleGetCompanyLogo(id);
	}

	getCompanyLogos() {
		// Delegate
		return CompanyStorage.handleGetCompanyLogos();
	}

	saveCompanyLogo(company) {
		// Delegate
		return CompanyStorage.handleSaveCompanyLogo(company);
	}

	getCarLogo(id) {
		// Delegate
		return CarStorage.handleGetCarLogo(id);
	}

	getCarLogos() {
		// Delegate
		return CarStorage.handleGetCarLogos();
	}

	saveCarLogo(car) {
		// Delegate
		return CarStorage.handleSaveCarLogo(car);
	}

	deleteCompany(id) {
		// Delegate
		return CompanyStorage.handleDeleteCompany(id);
	}

	saveCompany(company) {
		// Delegate
		return CompanyStorage.handleSaveCompany(company);
	}

	getSiteAreas(searchValue, siteID=null, withChargeBoxes=false, numberOfSiteArea=500) {
		// Delegate
		return SiteAreaStorage.handleGetSiteAreas(searchValue, siteID,
			withChargeBoxes, numberOfSiteArea);
	}

	saveSiteArea(siteArea) {
		// Delegate
		return SiteAreaStorage.handleSaveSiteArea(siteArea);
	}

	saveSiteAreaImage(siteArea) {
		// Delegate
		return SiteAreaStorage.handleSaveSiteAreaImage(siteArea);
	}

	deleteSiteArea(id) {
		// Delegate
		return SiteAreaStorage.handleDeleteSiteArea(id);
	}

	getSiteArea(id, withChargingStations=false, withSite=false) {
		// Delegate
		return SiteAreaStorage.handleGetSiteArea(id, withChargingStations, withSite);
	}

	getSiteAreaImage(id) {
		// Delegate
		return SiteAreaStorage.handleGetSiteAreaImage(id);
	}

	getSiteAreaImages() {
		// Delegate
		return SiteAreaStorage.handleGetSiteAreaImages();
	}

	getSites(searchValue, companyID=null, withCompany=false, withSiteAreas=false,
			withChargeBoxes=false, numberOfSite=500) {
		// Delegate
		return SiteStorage.handleGetSites(searchValue, companyID, withCompany, withSiteAreas,
			withChargeBoxes, numberOfSite);
	}

	saveSite(site) {
		// Delegate
		return SiteStorage.handleSaveSite(site);
	}

	saveSiteImage(site) {
		// Delegate
		return SiteStorage.handleSaveSiteImage(site);
	}

	deleteSite(id) {
		// Delegate
		return SiteStorage.handleDeleteSite(id);
	}

	getSite(id) {
		// Delegate
		return SiteStorage.handleGetSite(id);
	}

	getSiteImage(id) {
		// Delegate
		return SiteStorage.handleGetSiteImage(id);
	}

	getSiteImages() {
		// Delegate
		return SiteStorage.handleGetSiteImages();
	}

	getCars(searchValue, numberOfCar=500) {
		// Delegate
		return CarStorage.handleGetCars(searchValue, numberOfCar);
	}

	saveCar(car) {
		// Delegate
		return CarStorage.handleSaveCar(car);
	}

	saveCarImages(car) {
		// Delegate
		return CarStorage.handleSaveCarImages(car);
	}

	deleteCar(id) {
		// Delegate
		return CarStorage.handleDeleteCar(id);
	}

	getCar(id) {
		// Delegate
		return CarStorage.handleGetCar(id);
	}

	getCarImage(id) {
		// Delegate
		return CarStorage.handleGetCarImage(id);
	}

	getCarImages() {
		// Delegate
		return CarStorage.handleGetCarImages();
	}
}

module.exports = MongoDBStorage;
