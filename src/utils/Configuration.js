const cfenv = require('cfenv');
let config = require('../config.json');

require('source-map-support').install();

// Cloud Foundry App Env
const _appEnv = cfenv.getAppEnv();

class Configuration {
	// Read the config file
	static getConfig() {
		return config;
	}

	// Scheduler config
	static getSchedulerConfig() {
		// Read conf
		return Configuration.getConfig().Scheduler;
	}

	// Central System config
	static getCentralSystemsConfig() {
		let centralSystems = Configuration.getConfig().CentralSystems;
		// Check Cloud Foundry
		if (centralSystems && Configuration.isCloudFoundry()) {
			// Change host/port
			for (const centralSystem of centralSystems) {
        // CF Environment: Override
				centralSystem.port = _appEnv.port;
				centralSystem.host = _appEnv.bind;
			}
		}
		// Read conf
		return centralSystems;
	}

	// Notification config
	static getNotificationConfig() {
		// Read conf
		return Configuration.getConfig().Notification;
	}

	// Authorization config
	static getAuthorizationConfig() {
		// Read conf
		return Configuration.getConfig().Authorization;
	}

	static isCloudFoundry() {
		return !_appEnv.isLocal;
	}

	static getCFInstanceIndex() {
		if (Configuration.isCloudFoundry()) {
      return _appEnv.app.instance_index;
    }
	}

  static getCFApplicationID() {
		if (Configuration.isCloudFoundry()) {
      return _appEnv.app.application_id;
    }
	}

  static getCFApplicationIDAndInstanceIndex() {
		if (Configuration.isCloudFoundry()) {
      return Configuration.getCFApplicationID() + ':' + Configuration.getCFInstanceIndex();
    }
	}

  // Central System REST config
	static getCentralSystemRestServiceConfig() {
		let centralSystemRestService = Configuration.getConfig().CentralSystemRestService;
		// Check Cloud Foundry
		if (centralSystemRestService && Configuration.isCloudFoundry()) {
			// CF Environment: Override
			centralSystemRestService.port = _appEnv.port;
			centralSystemRestService.host = _appEnv.bind;
		}
		// Read conf
		return centralSystemRestService;
	}

	// Central System REST config
	static getWSDLEndpointConfig() {
		return Configuration.getConfig().WSDLEndpoint;
	}

	// Central System Front-End config
	static getCentralSystemFrontEndConfig() {
		// Read conf
		return Configuration.getConfig().CentralSystemFrontEnd;
	}

	// Email config
	static getEmailConfig() {
		// Read conf
		return Configuration.getConfig().Email;
	}

	// Advanced config
	static getAdvancedConfig() {
		// Read conf
		return Configuration.getConfig().Advanced;
	}

	static saveAdvancedConfig(advancedConfig) {
		// Read conf
		let config = Configuration.getConfig();
		// Set
		config.Advanced = advancedConfig;
		// Save Config
		Configuration.saveConfig(config);
	}

	// Locale config
	static getLocalesConfig() {
		// Read conf
		return Configuration.getConfig().Locales;
	}

	// DB config
	static getStorageConfig() {
		let storage = Configuration.getConfig().Storage;
		// Check Cloud Foundry
		if (storage && Configuration.isCloudFoundry()) {
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
	}

	// Central System config
	static getChargingStationConfig() {
		// Read conf
		return Configuration.getConfig().ChargingStation;
	}

	// Logging
	static getLoggingConfig() {
		// Read conf
		return Configuration.getConfig().Logging;
	}
}

module.exports=Configuration;
