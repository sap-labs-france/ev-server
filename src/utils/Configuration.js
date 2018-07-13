const fs = require('fs');
const path = require('path');
const cfenv = require('cfenv');
const _config = require('../config.json');
const url = require('url');
require('source-map-support').install();

// Cloud Foundry App Env
let _appEnv = cfenv.getAppEnv();

module.exports = {
	// Read the config file
	getConfig() {
		return _config;
	},

	// Scheduler config
	getSchedulerConfig() {
		// Read conf
		return this.getConfig().Scheduler;
	},

	// Central System config
	getCentralSystemsConfig() {
		let centralSystems = this.getConfig().CentralSystems;
		// Check env
		if (centralSystems && !_appEnv.isLocal) {
			// Parse the URL
			let urlParsed = url.parse(_appEnv.url, true);
			// Change host/port
			centralSystems.forEach((centralSystem) => {
				// Set Cloud Foundry flag
				centralSystem.cloudFoundry = !_appEnv.isLocal;
				// CF Environment: Override
				centralSystem.port = _appEnv.port;
				centralSystem.protocol = urlParsed.protocol.substring(0, urlParsed.protocol.length-1);
				centralSystem.host = urlParsed.hostname;
			});
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

	// Central System REST config
	getCentralSystemRestServiceConfig() {
		let centralSystemRestService = this.getConfig().CentralSystemRestService;
		// Check env
		if (centralSystemRestService && !_appEnv.isLocal) {
			// Set Cloud Foundry flag
			centralSystemRestService.cloudFoundry = !_appEnv.isLocal;
			// CF Environment: Override
			centralSystemRestService.port = _appEnv.port;
			// Parse the URL
			let urlParsed = url.parse(_appEnv.url, true);
			// Set URL
			centralSystemRestService.protocol =
				urlParsed.protocol.substring(0, urlParsed.protocol.length-1);
			centralSystemRestService.host = urlParsed.hostname;
		}
		// Read conf
		return centralSystemRestService;
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
		// Set Cloud Foundry flag
		storage.cloudFoundry = !_appEnv.isLocal;
		// Check env
		if (storage && !_appEnv.isLocal) {
			// CF Environment: Override
			let mongoDBService = _appEnv.services.mongodb[0];
			// Set MongoDB URI
			storage.uri = mongoDBService.credentials.uri;
			storage.port = mongoDBService.credentials.port;
			storage.user = mongoDBService.credentials.username;
			storage.password = mongoDBService.credentials.password;
			storage.replicaSet = mongoDBService.credentials.replicaset;
			// Replica?
			if (storage.replica) {
				storage.replica.uri = mongoDBService.credentials.uri;
				storage.replica.user = mongoDBService.credentials.username;
				storage.replica.password = mongoDBService.credentials.password;
			}
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
