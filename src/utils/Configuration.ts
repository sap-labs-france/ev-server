import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import CentralSystemConfiguration from '../types/configuration/CentralSystemConfiguration';
import CentralSystemFrontEndConfiguration from '../types/configuration/CentralSystemFrontEndConfiguration';
import CentralSystemRestServiceConfiguration from '../types/configuration/CentralSystemRestServiceConfiguration';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServer';
import ChargingStationConfiguration from '../types/configuration/ChargingStationConfiguration';
import ClusterConfiguration from '../types/configuration/ClusterConfiguration';
import { Configuration as ConfigurationType } from '../types/configuration/Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
import EVDatabaseConfiguration from '../types/configuration/EVDatabaseAPIConfiguration';
import EmailConfiguration from '../types/configuration/EmailConfiguration';
import FirebaseConfiguration from '../types/configuration/FirebaseConfiguration';
import HealthCheckConfiguration from '../types/configuration/HealthCheckConfiguration';
import JsonEndpointConfiguration from '../types/configuration/JsonEndpointConfiguration';
import LocalesConfiguration from '../types/configuration/LocalesConfiguration';
import LoggingConfiguration from '../types/configuration/LoggingConfiguration';
import MigrationConfiguration from '../types/configuration/MigrationConfiguration';
import NotificationConfiguration from '../types/configuration/NotificationConfiguration';
import OCPIEndpointConfiguration from '../types/configuration/OCPIEndpointConfiguration';
import OCPIServiceConfiguration from '../types/configuration/OCPIServiceConfiguration';
import ODataServiceConfiguration from '../types/configuration/ODataServiceConfiguration';
import SchedulerConfiguration from '../types/configuration/SchedulerConfiguration';
import StorageConfiguration from '../types/configuration/StorageConfiguration';
import Utils from './Utils';
import WSClientConfiguration from '../types/configuration/WSClientConfiguration';
import WSDLEndpointConfiguration from '../types/configuration/WSDLEndpointConfiguration';
import cfenv from 'cfenv';
import fs from 'fs';
import global from './../types/GlobalType';
import os from 'os';

const _appEnv = cfenv.getAppEnv();
let config: ConfigurationType = null;

export default class Configuration {
  // Read the config file
  static getConfig(): ConfigurationType {
    if (!config) {
      config = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/config.json`, 'utf8'));
    }
    return config;
  }

  // Crypto config
  public static getCryptoConfig(): CryptoConfiguration {
    // Read conf
    return Configuration.getConfig().Crypto;
  }

  // Scheduler config
  static getSchedulerConfig(): SchedulerConfiguration {
    // Read conf
    return Configuration.getConfig().Scheduler;
  }

  // Firebase config
  static getFirebaseConfig(): FirebaseConfiguration {
    // Read conf
    return Configuration.getConfig().Firebase;
  }

  // Cluster config
  static getClusterConfig(): ClusterConfiguration {
    let clusterConfig: ClusterConfiguration = Configuration.getConfig().Cluster;
    const nbCpus = os.cpus().length;
    // Read conf and set defaults values
    if (!clusterConfig) {
      clusterConfig = {} as ClusterConfiguration;
    }
    if (!clusterConfig.enabled) {
      clusterConfig.enabled = false;
    }
    // Check number of workers
    if (clusterConfig.numWorkers) {
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
  static getCentralSystemsConfig(): CentralSystemConfiguration[] {
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
  static getNotificationConfig(): NotificationConfiguration {
    // Read conf
    return Configuration.getConfig().Notification;
  }

  // Authorization config
  static getAuthorizationConfig(): AuthorizationConfiguration {
    // Read conf
    return Configuration.getConfig().Authorization;
  }

  static isCloudFoundry(): boolean {
    return !_appEnv.isLocal;
  }

  static getCFInstanceIndex(): string {
    if (Configuration.isCloudFoundry()) {
      return _appEnv.app.instance_index;
    }
  }

  static getCFApplicationID(): string {
    if (Configuration.isCloudFoundry()) {
      return _appEnv.app.application_id;
    }
  }

  static getCFApplicationIDAndInstanceIndex(): string {
    if (Configuration.isCloudFoundry()) {
      return Configuration.getCFApplicationID() + ':' + Configuration.getCFInstanceIndex();
    }
  }

  // Central System REST config
  static getCentralSystemRestServiceConfig(): CentralSystemRestServiceConfiguration {
    const centralSystemRestService = Configuration.getConfig().CentralSystemRestService;
    // Check Cloud Foundry
    if (centralSystemRestService) {
      if (Configuration.isCloudFoundry()) {
        // CF Environment: Override
        centralSystemRestService.port = _appEnv.port;
        centralSystemRestService.host = _appEnv.bind;
      }
      if (Utils.isUndefined(centralSystemRestService.socketIO)) {
        centralSystemRestService.socketIO = true;
      }
      if (Utils.isUndefined(centralSystemRestService.socketIOSingleNotificationIntervalSecs)) {
        centralSystemRestService.socketIOSingleNotificationIntervalSecs = 1;
      }
      if (Utils.isUndefined(centralSystemRestService.socketIOListNotificationIntervalSecs)) {
        centralSystemRestService.socketIOListNotificationIntervalSecs = 5;
      }
    }
    // Read conf
    return centralSystemRestService;
  }

  // OCPI Server Configuration
  static getOCPIServiceConfig(): OCPIServiceConfiguration {
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
  static getODataServiceConfig(): ODataServiceConfiguration {
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

  // RestService Configuration - Internet view
  static getCentralSystemRestServer(): CentralSystemServerConfiguration {
    return Configuration.getConfig().CentralSystemServer;
  }

  // Central System REST config
  static getWSDLEndpointConfig(): WSDLEndpointConfiguration {
    return Configuration.getConfig().WSDLEndpoint;
  }

  // Central System Json config
  static getJsonEndpointConfig(): JsonEndpointConfiguration {
    return Configuration.getConfig().JsonEndpoint;
  }

  // Central System OCPI config
  static getOCPIEndpointConfig(): OCPIEndpointConfiguration {
    return Configuration.getConfig().OCPIEndpoint;
  }

  // Central System Front-End config
  static getCentralSystemFrontEndConfig(): CentralSystemFrontEndConfiguration {
    // Read conf
    return Configuration.getConfig().CentralSystemFrontEnd;
  }

  // Email config
  static getEmailConfig(): EmailConfiguration {
    // Read conf
    return Configuration.getConfig().Email;
  }

  // Email config
  static getEVDatabaseConfig(): EVDatabaseConfiguration {
    // Read conf
    return Configuration.getConfig().EVDatabase;
  }

  // Locale config
  static getLocalesConfig(): LocalesConfiguration {
    // Read conf
    return Configuration.getConfig().Locales;
  }

  // DB config
  static getStorageConfig(): StorageConfiguration {
    const storage: StorageConfiguration = Configuration.getConfig().Storage;
    // Check Cloud Foundry
    if (storage && Configuration.isCloudFoundry()) {
      // CF Environment: Override
      // Check if MongoDB is provisioned inside SCP
      if (_appEnv.services.mongodb) {
        // Only one DB
        const mongoDBService = _appEnv.services.mongodb[0];
        // Set MongoDB URI
        if (mongoDBService) {
          storage.uri = mongoDBService.credentials.uri;
          storage.port = mongoDBService.credentials.port;
          storage.user = mongoDBService.credentials.username;
          storage.password = mongoDBService.credentials.password;
          storage.replicaSet = mongoDBService.credentials.replicaset;
        }
        // Provisioned with User Provided Service
      } else if (_appEnv.services['user-provided']) {
        // Find the service
        const mongoDBService = _appEnv.services['user-provided'].find((userProvidedService) =>
          userProvidedService.name && userProvidedService.name.includes('mongodb'));
        // Set MongoDB URI
        if (mongoDBService) {
          storage.uri = mongoDBService.credentials.uri;
        }
      }
    }
    // Read conf
    return storage;
  }

  // Central System config
  static getChargingStationConfig(): ChargingStationConfiguration {
    // Read conf and set defaults values
    const chargingStationConfiguration: ChargingStationConfiguration = Configuration.getConfig().ChargingStation;
    if (Utils.isUndefined(chargingStationConfiguration.useServerLocalIPForRemoteCommand)) {
      chargingStationConfiguration.useServerLocalIPForRemoteCommand = false;
    }
    return chargingStationConfiguration;
  }

  // Logging
  static getLoggingConfig(): LoggingConfiguration {
    // Read conf
    return Configuration.getConfig().Logging;
  }

  // WSClient
  static getWSClientConfig(): WSClientConfiguration {
    // Read conf and set defaults values
    if (Utils.isUndefined(Configuration.getConfig().WSClient)) {
      Configuration.getConfig().WSClient = {} as WSClientConfiguration;
    }
    if (Utils.isUndefined(Configuration.getConfig().WSClient.autoReconnectMaxRetries)) {
      Configuration.getConfig().WSClient.autoReconnectMaxRetries = Constants.WS_DEFAULT_RECONNECT_MAX_RETRIES;
    }
    if (Utils.isUndefined(Configuration.getConfig().WSClient.autoReconnectTimeout)) {
      Configuration.getConfig().WSClient.autoReconnectTimeout = Constants.WS_DEFAULT_RECONNECT_TIMEOUT;
    }
    return Configuration.getConfig().WSClient;
  }

  static getHealthCheckConfig(): HealthCheckConfiguration {
    // Read conf and set defaults values
    if (Utils.isUndefined(Configuration.getConfig().HealthCheck)) {
      Configuration.getConfig().HealthCheck = {} as HealthCheckConfiguration;
    }
    if (Utils.isUndefined(Configuration.getConfig().HealthCheck.enabled)) {
      Configuration.getConfig().HealthCheck.enabled = true;
    }
    return Configuration.getConfig().HealthCheck;
  }

  static getMigrationConfig(): MigrationConfiguration {
    // Read conf and set defaults values
    if (Utils.isUndefined(Configuration.getConfig().Migration)) {
      Configuration.getConfig().Migration = {} as MigrationConfiguration;
    }
    if (Utils.isUndefined(Configuration.getConfig().Migration.active)) {
      Configuration.getConfig().Migration.active = false;
    }
    return Configuration.getConfig().Migration;
  }
}

