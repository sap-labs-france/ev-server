const cfenv = require('cfenv');
const url = require('url');
let config = require('../config.json');

require('source-map-support').install();

// Cloud Foundry App Env
let _appEnv = cfenv.getAppEnv();

module.exports = {
	// Read the config file
	getConfig() {
		return config;
	},

	// Scheduler config
	getSchedulerConfig() {
		// Read conf
		return this.getConfig().Scheduler;
	},

	// Central System config
	getCentralSystemsConfig() {
		let centralSystems = this.getConfig().CentralSystems;
		// Check Cloud Foundry
		if (centralSystems && !_appEnv.isLocal) {
			// Parse the URL
			let urlParsed = url.parse(_appEnv.url, true);
			// Change host/port
			for (const centralSystem of centralSystems) {
				// CF Environment: Override
				centralSystem.port = _appEnv.port;
				centralSystem.protocol = "http"; // Always HTTP
				centralSystem.host = null;
			}
		}
		// Read conf
		return centralSystems;
	},

	// Notification config
	getNotificationConfig() {
		// Read conf
		return this.getConfig().Notification;
	},

	// Authorization config
	getAuthorizationConfig() {
		// Read conf
		return this.getConfig().Authorization;
	},

	isCloudFoundry() {
		return !_appEnv.isLocal;
	},

	// Central System REST config
	getCentralSystemRestServiceConfig() {
		let centralSystemRestService = this.getConfig().CentralSystemRestService;
		// Check Cloud Foundry
		if (centralSystemRestService && !_appEnv.isLocal) {
			// CF Environment: Override
			centralSystemRestService.port = _appEnv.port;
			// Set URL
			centralSystemRestService.protocol = "http"; // Always HTTP
			centralSystemRestService.host = null;
		}
		// Read conf
		return centralSystemRestService;
	},

	// Central System REST config
	getWSDLEndpointConfig() {
		return this.getConfig().WSDLEndpoint;
	},

	// Central System Front-End config
	getCentralSystemFrontEndConfig() {
		// Read conf
		return this.getConfig().CentralSystemFrontEnd;
	},

	// Email config
	getEmailConfig() {
		// Read conf
		return this.getConfig().Email;
	},

	// Advanced config
	getAdvancedConfig() {
		// Read conf
		return this.getConfig().Advanced;
	},

	saveAdvancedConfig(advancedConfig) {
		// Read conf
		let config = this.getConfig();
		// Set
		config.Advanced = advancedConfig;
		// Save Config
		this.saveConfig(config);
	},

	// Locale config
	getLocalesConfig() {
		// Read conf
		return this.getConfig().Locales;
	},

	// DB config
	getStorageConfig() {
		let storage = this.getConfig().Storage;
		// Check Cloud Foundry
		if (storage && !_appEnv.isLocal) {
			// CF Environment: Override
			let mongoDBService = _appEnv.services.mongodb[0];
			// Set MongoDB URI
			storage.uri = mongoDBService.credentials.uri;
			storage.port = mongoDBService.credentials.port;
			storage.user = mongoDBService.credentials.username;
			storage.password = mongoDBService.credentials.password;
			storage.replicaSet = mongoDBService.credentials.replicaset;
		}
		// Read conf
		return storage;
	},

	// Central System config
	getChargingStationConfig() {
		// Read conf
		return this.getConfig().ChargingStation;
	}
};
