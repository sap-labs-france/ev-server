const Logging = require('../../utils/Logging');
const LoggingStorage = require('./storage/LoggingStorage');
const ChargingStationStorage = require('./storage/ChargingStationStorage');
const PricingStorage = require('./storage/PricingStorage');
const TransactionStorage = require('./storage/TransactionStorage');
const NotificationStorage = require('./storage/NotificationStorage');
const StatisticsStorage = require('./storage/StatisticsStorage');
const UserStorage = require('./storage/UserStorage');
const VehicleStorage = require('./storage/VehicleStorage');
const CompanyStorage = require('./storage/CompanyStorage');
const SiteStorage = require('./storage/SiteStorage');
const SiteAreaStorage = require('./storage/SiteAreaStorage');
const MigrationStorage = require('./storage/MigrationStorage');
const VehicleManufacturerStorage = require('./storage/VehicleManufacturerStorage');
const MongoClient = require('mongodb').MongoClient;
const mongoUriBuilder = require('mongo-uri-builder');
const urlencode = require('urlencode');
const MongoDBStorageNotification = require('./MongoDBStorageNotification');

require('source-map-support').install();

let _dbConfig;
let _mongoDBClient;
let _evseDB;
let _mongoDBStorageNotification;
let _centralRestServer;

class MongoDBStorage {
	// Create database access
	constructor(dbConfig) {
		// Keep local
		_dbConfig = dbConfig;
	}

	async checkAndCreateCollection(db, allCollections, name, indexes) {
		// Check Logs
		let foundCollection = allCollections.find((collection) => {
			return collection.name == name;
		});
		// Check if it exists
		if (!foundCollection) {
			// Create
			await db.createCollection(name);
		}
		// Indexes?
		if (indexes) {
			// Get current indexes
			let existingIndexes = await db.collection(name).listIndexes().toArray();
			// Check each index
			indexes.forEach(async (index) => {
				// Create
				// Check if it exists
				let foundIndex = existingIndexes.find((existingIndex) => {
					return (JSON.stringify(existingIndex.key) === JSON.stringify(index.fields));
				});
				// Found?
				if (!foundIndex) {
					// No: Create Index
					await db.collection(name).createIndex(index.fields, index.options);
				}
			});
		}
	}

	async checkEVSEDatabase(db) {
		// Get all the collections
		let collections = await db.listCollections({}).toArray();
		// Check only collections with indexes
		// Users
		await this.checkAndCreateCollection(db, collections, 'users', [
			{ fields: { email: 1 }, options: { unique: true } } 
		]);
		await this.checkAndCreateCollection(db, collections, 'eulas');
		// Logs
		await this.checkAndCreateCollection(db, collections, 'logs', [
			{ fields: { timestamp: 1 } },
			{ fields: { level: 1 } },
			{ fields: { type: 1 }	} 
		]);
		// MeterValues
		await this.checkAndCreateCollection(db, collections, 'metervalues', [
			{ fields: { timestamp: 1 } },
			{ fields: { transactionId: 1 } }
		]);
		// Tags
		await this.checkAndCreateCollection(db, collections, 'tags', [
			{ fields: { userID: 1 } }
		]);
		// Sites/Users
		await this.checkAndCreateCollection(db, collections, 'siteusers', [
			{ fields: { siteID: 1 } },
			{ fields: { userID: 1 } }
		]);
		// Transactions
		await this.checkAndCreateCollection(db, collections, 'transactions', [
			{ fields: { timestamp: 1 } },
			{ fields: { chargeBoxID: 1 } },
			{ fields: { userID: 1 } }
		]);
	}

	async start() {
		// Log
		console.log(`Connecting to '${_dbConfig.implementation}'...`);
		// Build EVSE URL
		let mongoUrl;
		// URI provided?
		if (_dbConfig.uri) {
			// Yes: use it
			mongoUrl = _dbConfig.uri;
		} else {
			// No: Build it
			mongoUrl = mongoUriBuilder({
				host: urlencode(_dbConfig.host),
				port: urlencode(_dbConfig.port),
				username: urlencode(_dbConfig.user),
				password: urlencode(_dbConfig.password),
				database: urlencode(_dbConfig.database),
				options: {
					replicaSet: _dbConfig.replicaSet
				}
			});
		}
		// Connect to EVSE
		_mongoDBClient = await MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true,
				poolSize: _dbConfig.poolSize,
				replicaSet: _dbConfig.replicaSet,
				loggerLevel: (_dbConfig.debug ? 'debug' : null)
			}
		);
		// Get the EVSE DB
		_evseDB = _mongoDBClient.db(_dbConfig.schema);

		// Check EVSE Database
		await this.checkEVSEDatabase(_evseDB);

		// Set EVSE DB
		StatisticsStorage.setDatabase(_evseDB);
		LoggingStorage.setDatabase(_evseDB);
		ChargingStationStorage.setDatabase(_evseDB);
		PricingStorage.setDatabase(_evseDB);
		TransactionStorage.setDatabase(_evseDB);
		UserStorage.setDatabase(_evseDB);
		CompanyStorage.setDatabase(_evseDB);
		SiteStorage.setDatabase(_evseDB);
		SiteAreaStorage.setDatabase(_evseDB);
		VehicleStorage.setDatabase(_evseDB);
		VehicleManufacturerStorage.setDatabase(_evseDB);
		MigrationStorage.setDatabase(_evseDB);
		NotificationStorage.setDatabase(_evseDB);
		// Log
		Logging.logInfo({
			module: 'MongoDBStorage', method: 'start', action: 'Startup',
			message: `Connected to '${_dbConfig.implementation}' successfully`
		});
		console.log(`Connected to '${_dbConfig.implementation}' successfully`);
	}

	async setCentralRestServer(centralRestServer) {
		if (_dbConfig.monitorDBChange) {
			// Monitor MongoDB for Notifications
			_mongoDBStorageNotification = new MongoDBStorageNotification(
				_dbConfig, _evseDB);
			// Set Central Rest Server
			_mongoDBStorageNotification.setCentralRestServer(centralRestServer);
			// Start
			await _mongoDBStorageNotification.start();
		}
	}

	getEndUserLicenseAgreement(language = 'en') {
		// Delegate
		return UserStorage.handleGetEndUserLicenseAgreement(language);
	}

	getConfigurationParamValue(chargeBoxID, paramName) {
		// Delegate
		return ChargingStationStorage.handleGetConfigurationParamValue(chargeBoxID, paramName);
	}

	getLogs(dateFrom, level, type, chargingStation, searchValue, action, limit, skip, sort) {
		// Delegate
		return LoggingStorage.handleGetLogs(dateFrom, level, type, chargingStation, searchValue, action, limit, skip, sort);
	}

	getLog(id) {
		// Delegate
		return LoggingStorage.handleGetLog(id);
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
		return MigrationStorage.handleSaveMigration(migration);
	}

	saveMeterValues(meterValues) {
		// Delegate
		return TransactionStorage.handleSaveMeterValues(meterValues);
	}

	getTransactions(searchValue = null, filter = {}, siteID = null, withChargeBoxes = false, limit, skip) {
		// Delegate
		return TransactionStorage.handleGetTransactions(searchValue, filter, siteID, withChargeBoxes, limit, skip);
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

	getChargingStations(searchValue, siteAreaID, withNoSiteArea = false, limit, skip) {
		// Delegate
		return ChargingStationStorage.handleGetChargingStations(searchValue, siteAreaID, withNoSiteArea, limit, skip);
	}

	getChargingStation(id) {
		// Delegate
		return ChargingStationStorage.handleGetChargingStation(id);
	}

	getUsers(searchValue, siteID, limit, skip) {
		// Delegate
		return UserStorage.handleGetUsers(searchValue, siteID, limit, skip);
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

	getCompanies(searchValue, withSites = false, limit, skip) {
		// Delegate
		return CompanyStorage.handleGetCompanies(searchValue, withSites, limit, skip);
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

	getVehicleManufacturers(searchValue, withVehicles = false, vehicleType, limit, skip) {
		// Delegate
		return VehicleManufacturerStorage.handleGetVehicleManufacturers(
			searchValue, withVehicles, vehicleType, limit, skip);
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

	getSiteAreas(searchValue, siteID = null, withChargeBoxes = false, limit, skip) {
		// Delegate
		return SiteAreaStorage.handleGetSiteAreas(searchValue, siteID,
			withChargeBoxes, limit, skip);
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

	getSiteArea(id, withChargeBoxes = false, withSite = false) {
		// Delegate
		return SiteAreaStorage.handleGetSiteArea(id, withChargeBoxes, withSite);
	}

	getSiteAreaImage(id) {
		// Delegate
		return SiteAreaStorage.handleGetSiteAreaImage(id);
	}

	getSiteAreaImages() {
		// Delegate
		return SiteAreaStorage.handleGetSiteAreaImages();
	}

	getSites(searchValue, companyID = null, userID = null, withCompany = false, withSiteAreas = false,
		withChargeBoxes = false, withUsers = false, limit, skip) {
		// Delegate
		return SiteStorage.handleGetSites(searchValue, companyID, userID, withCompany, withSiteAreas,
			withChargeBoxes, withUsers, limit, skip);
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

	getSite(id, withCompany = false, withUsers = false) {
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

	getVehicles(searchValue, vehicleManufacturerID = null, vehicleType, limit, skip) {
		// Delegate
		return VehicleStorage.handleGetVehicles(searchValue, vehicleManufacturerID, vehicleType, limit, skip);
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

	getChargingStationStats(filter, siteID, groupBy) {
		// Delegate
		return StatisticsStorage.handleGetChargingStationStats(filter, siteID, groupBy);
	}

	getUserStats(filter, siteID, groupBy) {
		// Delegate
		return StatisticsStorage.handleGetUserStats(filter, siteID, groupBy);
	}
}

module.exports = MongoDBStorage;
