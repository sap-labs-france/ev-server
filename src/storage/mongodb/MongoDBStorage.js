const mongoose = require('mongoose');
const Logging = require('../../utils/Logging');
const LoggingStorage = require("./storage/LoggingStorage");
const ChargingStationStorage = require('./storage/ChargingStationStorage');
const PricingStorage = require('./storage/PricingStorage');
const TransactionStorage = require('./storage/TransactionStorage');
const NotificationStorage = require('./storage/NotificationStorage');
const UserStorage = require('./storage/UserStorage');
const VehicleStorage = require('./storage/VehicleStorage');
const CompanyStorage = require('./storage/CompanyStorage');
const SiteStorage = require('./storage/SiteStorage');
const SiteAreaStorage = require('./storage/SiteAreaStorage');
const MigrationStorage = require('./storage/MigrationStorage');
const VehicleManufacturerStorage = require('./storage/VehicleManufacturerStorage');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const mongoUriBuilder = require('mongo-uri-builder');
const urlencode = require('urlencode');

require('source-map-support').install();

let _dbConfig;
let _db;

class MongoDBStorage {
	// Create database access
	constructor(dbConfig) {
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
		// Build URL
		let mongoUrl = mongoUriBuilder({
			username: urlencode(_dbConfig.user),
			password: urlencode(_dbConfig.password),
			host: urlencode(_dbConfig.host),
			port: urlencode(_dbConfig.port),
			database: urlencode(_dbConfig.schema),
		});

		// MONGOOSE --------------------------------------------------
		// Connect
		mongoose.connect(mongoUrl,
				{"useMongoClient": true}, (err) => {
			if (!err) {
				// Log
				Logging.logInfo({
					module: "MongoDBStorage", method: "start", action: "Startup",
					message: `Connected to MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}' and using schema '${_dbConfig.schema}'` });
			}
		});
		// MONGOOSE --------------------------------------------------

		// MongoDB Native Driver
		return MongoClient.connect(mongoUrl, { useNewUrlParser: true }).then((client) => {
			// Get the DB
			let db = client.db(_dbConfig.schema);
			// Set DB
			LoggingStorage.setDatabase(db);
			ChargingStationStorage.setDatabase(db);
			PricingStorage.setDatabase(db);
			TransactionStorage.setDatabase(db);
			UserStorage.setDatabase(db);
			CompanyStorage.setDatabase(db);
			SiteStorage.setDatabase(db);
			SiteAreaStorage.setDatabase(db);
			VehicleStorage.setDatabase(db);
			VehicleManufacturerStorage.setDatabase(db);
			// Log
			Logging.logInfo({
				module: "MongoDBStorage", method: "start", action: "Startup",
				message: `Connected to MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}' and using schema '${_dbConfig.schema}'` });
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
		VehicleStorage.setCentralRestServer(centralRestServer);
		VehicleManufacturerStorage.setCentralRestServer(centralRestServer);
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

	saveTransaction(transaction) {
		// Delegate
		return TransactionStorage.handleSaveTransaction(transaction);
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

	saveChargingStationParams(chargingStation) {
		// Delegate
		return ChargingStationStorage.handleSaveChargingStationParams(
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

	getUsers(searchValue, siteID, numberOfUser=500) {
		// Delegate
		return UserStorage.handleGetUsers(searchValue, siteID, numberOfUser);
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

	getCompanies(searchValue, withSites=false, numberOfCompanies=500) {
		// Delegate
		return CompanyStorage.handleGetCompanies(searchValue, withSites, numberOfCompanies);
	}

	getCompany(id) {
		// Delegate
		return CompanyStorage.handleGetCompany(id);
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

	deleteCompany(id) {
		// Delegate
		return CompanyStorage.handleDeleteCompany(id);
	}

	saveCompany(company) {
		// Delegate
		return CompanyStorage.handleSaveCompany(company);
	}

	getVehicleManufacturers(searchValue, withVehicles=false, vehicleType, numberOfVehicleManufacturers=500) {
		// Delegate
		return VehicleManufacturerStorage.handleGetVehicleManufacturers(
			searchValue, withVehicles, vehicleType, numberOfVehicleManufacturers);
	}

	getVehicleManufacturer(id) {
		// Delegate
		return VehicleManufacturerStorage.handleGetVehicleManufacturer(id);
	}

	deleteVehicleManufacturer(id) {
		// Delegate
		return VehicleManufacturerStorage.handleDeleteVehicleManufacturer(id);
	}

	saveVehicleManufacturer(vehicleManufacturer) {
		// Delegate
		return VehicleManufacturerStorage.handleSaveVehicleManufacturer(vehicleManufacturer);
	}

	getVehicleManufacturerLogo(id) {
		// Delegate
		return VehicleManufacturerStorage.handleGetVehicleManufacturerLogo(id);
	}

	getVehicleManufacturerLogos() {
		// Delegate
		return VehicleManufacturerStorage.handleGetVehicleManufacturerLogos();
	}

	saveVehicleManufacturerLogo(vehicleManufacturer) {
		// Delegate
		return VehicleManufacturerStorage.handleSaveVehicleManufacturerLogo(vehicleManufacturer);
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

	getSites(searchValue, companyID=null, userID=null, withCompany=false, withSiteAreas=false,
			withChargeBoxes=false, withUsers=false, numberOfSite=500) {
		// Delegate
		return SiteStorage.handleGetSites(searchValue, companyID, userID, withCompany, withSiteAreas,
			withChargeBoxes, withUsers, numberOfSite);
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

	getSite(id, withCompany=false, withUsers=false) {
		// Delegate
		return SiteStorage.handleGetSite(id, withCompany, withUsers);
	}

	getSiteImage(id) {
		// Delegate
		return SiteStorage.handleGetSiteImage(id);
	}

	getSiteImages() {
		// Delegate
		return SiteStorage.handleGetSiteImages();
	}

	getVehicles(searchValue, vehicleManufacturerID=null, vehicleType, numberOfVehicle=500) {
		// Delegate
		return VehicleStorage.handleGetVehicles(searchValue, vehicleManufacturerID, vehicleType, numberOfVehicle);
	}

	saveVehicle(vehicle) {
		// Delegate
		return VehicleStorage.handleSaveVehicle(vehicle);
	}

	saveVehicleImages(vehicle) {
		// Delegate
		return VehicleStorage.handleSaveVehicleImages(vehicle);
	}

	deleteVehicle(id) {
		// Delegate
		return VehicleStorage.handleDeleteVehicle(id);
	}

	getVehicle(id) {
		// Delegate
		return VehicleStorage.handleGetVehicle(id);
	}

	getVehicleImage(id) {
		// Delegate
		return VehicleStorage.handleGetVehicleImage(id);
	}

	getVehicleImages() {
		// Delegate
		return VehicleStorage.handleGetVehicleImages();
	}
}

module.exports = MongoDBStorage;
