import Constants from './Constants';
import TSGlobal from './../types/GlobalType';
import cfenv from 'cfenv';
import fs from 'fs';
import os from 'os';
import SourceMap from 'source-map-support';
SourceMap.install();

declare const global: TSGlobal;
const {
  WS_DEFAULT_RECONNECT_MAX_RETRIES = Constants.WS_DEFAULT_RECONNECT_MAX_RETRIES,
  WS_DEFAULT_RECONNECT_TIMEOUT = Constants.WS_DEFAULT_RECONNECT_TIMEOUT
} = {};
const _appEnv = cfenv.getAppEnv();
let config = null;

export default class Configuration {
  // Read the config file
  static getConfig() {
    if (!config) {
      config = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/config.json`, 'utf8'));
    }
    return config;
  }

  // Scheduler config
  static getSchedulerConfig() {
    // Read conf
    return Configuration.getConfig().Scheduler;
  }

  // Cluster config
  static getClusterConfig() {
    let clusterConfig = Configuration.getConfig().Cluster;
    const nbCpus = os.cpus().length;
    // Read conf and set defaults values
    if (!clusterConfig) {
      clusterConfig = {};
    }
    if (!clusterConfig.hasOwnProperty('enabled')) {
      clusterConfig.enabled = false;
    }
    // Check number of workers
    if (clusterConfig.hasOwnProperty('numWorkers')) {
      if (clusterConfig.numWorkers < 2) {
        clusterConfig.numWorkers = 2;
      } else if (clusterConfig.numWorkers > nbCpus) {
        clusterConfig.numWorkers = nbCpus;
      }
    } else {
      clusterConfig.numWorkers = nbCpus;
    }
    return clusterConfig;
  }

  // Central System config
  static getCentralSystemsConfig() {
    const centralSystems = Configuration.getConfig().CentralSystems;
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
    const centralSystemRestService = Configuration.getConfig().CentralSystemRestService;
    // Check Cloud Foundry
    if (centralSystemRestService && Configuration.isCloudFoundry()) {
      // CF Environment: Override
      centralSystemRestService.port = _appEnv.port;
      centralSystemRestService.host = _appEnv.bind;
    }
    // Read conf
    return centralSystemRestService;
  }

  // OCPI Server Configuration
  static getOCPIServiceConfig() {
    const ocpiService = Configuration.getConfig().OCPIService;
    // Check Cloud Foundry
    if (ocpiService && Configuration.isCloudFoundry()) {
      // CF Environment: Override
      ocpiService.port = _appEnv.port;
      ocpiService.host = _appEnv.bind;
    }
    // Read conf
    return ocpiService;
  }

  // OData Server Configuration
  static getODataServiceConfig() {
    const oDataservice = Configuration.getConfig().ODataService;
    // Check Cloud Foundry
    if (oDataservice && Configuration.isCloudFoundry()) {
      // CF Environment: Override
      oDataservice.port = _appEnv.port;
      oDataservice.host = _appEnv.bind;
    }
    // Read conf
    return oDataservice;
  }

  // RestService Configuration - internet view
  static getCentralSystemRestServer() {
    return Configuration.getConfig().CentralSystemServer;
  }

  // Central System REST config
  static getWSDLEndpointConfig() {
    return Configuration.getConfig().WSDLEndpoint;
  }

  // Central System Json config
  static getJsonEndpointConfig() {
    return Configuration.getConfig().JsonEndpoint;
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
    const conf = Configuration.getConfig();
    // Set
    conf.Advanced = advancedConfig;
    // Save Config
    Configuration.saveConfig(conf);
  }

  /**
   * @todo
   * @param conf
   */
  static saveConfig(conf) {
    //
  }


  // Locale config
  static getLocalesConfig() {
    // Read conf
    return Configuration.getConfig().Locales;
  }

  // DB config
  static getStorageConfig() {
    const storage = Configuration.getConfig().Storage;
    // Check Cloud Foundry
    if (storage && Configuration.isCloudFoundry()) {
      // CF Environment: Override
      const mongoDBService = _appEnv.services.mongodb[0];
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

  // Testing
  static getTestConfig() {
    // Read conf
    return Configuration.getConfig().Test;
  }

  // WSClient
  static getWSClientConfig() {
    // Read conf and set defaults values
    if (!Configuration.getConfig().WSClient)
    { Configuration.getConfig().WSClient = {}; }
    if (!Configuration.getConfig().WSClient.hasOwnProperty('autoReconnectMaxRetries'))
    { Configuration.getConfig().WSClient.autoReconnectMaxRetries = WS_DEFAULT_RECONNECT_MAX_RETRIES; }
    if (!Configuration.getConfig().WSClient.hasOwnProperty('autoReconnectTimeout'))
    { Configuration.getConfig().WSClient.autoReconnectTimeout = WS_DEFAULT_RECONNECT_TIMEOUT; }
    return Configuration.getConfig().WSClient;
  }
}
