import { AppEnv, getAppEnv } from 'cfenv';
import { CloudCredentials, CloudCredentialsKey } from '../types/Cloud';

import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import AxiosConfiguration from '../types/configuration/AxiosConfiguration';
import CentralSystemConfiguration from '../types/configuration/CentralSystemConfiguration';
import CentralSystemFrontEndConfiguration from '../types/configuration/CentralSystemFrontEndConfiguration';
import CentralSystemRestServiceConfiguration from '../types/configuration/CentralSystemRestServiceConfiguration';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServer';
import ChargingStationConfiguration from '../types/configuration/ChargingStationConfiguration';
import ChargingStationTemplatesConfiguration from '../types/configuration/ChargingStationTemplatesConfiguration';
import ClusterConfiguration from '../types/configuration/ClusterConfiguration';
import { Configuration as ConfigurationData } from '../types/configuration/Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
import EVDatabaseConfiguration from '../types/configuration/EVDatabaseConfiguration';
import EmailConfiguration from '../types/configuration/EmailConfiguration';
import FirebaseConfiguration from '../types/configuration/FirebaseConfiguration';
import HealthCheckConfiguration from '../types/configuration/HealthCheckConfiguration';
import JsonEndpointConfiguration from '../types/configuration/JsonEndpointConfiguration';
import LoggingConfiguration from '../types/configuration/LoggingConfiguration';
import MigrationConfiguration from '../types/configuration/MigrationConfiguration';
import NotificationConfiguration from '../types/configuration/NotificationConfiguration';
import OCPIEndpointConfiguration from '../types/configuration/OCPIEndpointConfiguration';
import OCPIServiceConfiguration from '../types/configuration/OCPIServiceConfiguration';
import ODataServiceConfiguration from '../types/configuration/ODataServiceConfiguration';
import SchedulerConfiguration from '../types/configuration/SchedulerConfiguration';
import StorageConfiguration from '../types/configuration/StorageConfiguration';
import WSClientConfiguration from '../types/configuration/WSClientConfiguration';
import WSDLEndpointConfiguration from '../types/configuration/WSDLEndpointConfiguration';
import fs from 'fs';
import global from './../types/GlobalType';
import os from 'os';

export default class Configuration {
  private static config: ConfigurationData;
  private static appEnv: AppEnv;

  private constructor() {}

  // Crypto config
  public static getCryptoConfig(): CryptoConfiguration {
    // Read conf
    const cryptoConfig = Configuration.getConfig().Crypto;
    if (Configuration.isCloudFoundry()) {
      cryptoConfig.key = Configuration.getUserProvidedCredential(CloudCredentialsKey.CRYPTO_KEY);
    }
    return cryptoConfig;
  }

  // Scheduler config
  public static getSchedulerConfig(): SchedulerConfiguration {
    // Read conf
    return Configuration.getConfig().Scheduler;
  }

  // Firebase config
  public static getFirebaseConfig(): FirebaseConfiguration {
    // Read conf
    const firebaseConfig = Configuration.getConfig().Firebase;
    if (Configuration.isCloudFoundry()) {
      firebaseConfig.privateKeyID = Configuration.getUserProvidedCredential(CloudCredentialsKey.FIREBASE_PRIVATE_KEY_ID);
      firebaseConfig.privateKey = Configuration.getUserProvidedCredential(CloudCredentialsKey.FIREBASE_PRIVATE_KEY);
    }
    return firebaseConfig;
  }

  // Cluster config
  public static getClusterConfig(): ClusterConfiguration {
    // Read conf and set defaults values
    let clusterConfig: ClusterConfiguration = Configuration.getConfig().Cluster;
    const nbCpus = os.cpus().length;
    if (Configuration.isUndefined(clusterConfig)) {
      clusterConfig = {} as ClusterConfiguration;
    }
    if (Configuration.isUndefined(clusterConfig.enabled)) {
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
  public static getCentralSystemsConfig(): CentralSystemConfiguration[] {
    // Read conf
    const centralSystems = Configuration.getConfig().CentralSystems;
    // Check Cloud Foundry
    if (!Configuration.isUndefined(centralSystems) && Configuration.isCloudFoundry()) {
      // Change host/port
      for (const centralSystem of centralSystems) {
        // CF Environment: Override
        centralSystem.port = Configuration.getAppEnv().port;
        centralSystem.host = Configuration.getAppEnv().bind;
      }
    }
    return centralSystems;
  }

  // Notification config
  public static getNotificationConfig(): NotificationConfiguration {
    // Read conf
    return Configuration.getConfig().Notification;
  }

  // Authorization config
  public static getAuthorizationConfig(): AuthorizationConfiguration {
    // Read conf
    return Configuration.getConfig().Authorization;
  }

  public static isCloudFoundry(): boolean {
    return !Configuration.getAppEnv().isLocal;
  }

  public static getCFInstanceIndex(): string {
    if (Configuration.isCloudFoundry()) {
      return Configuration.getAppEnv().app['instance_index'];
    }
  }

  public static getCFApplicationID(): string {
    if (Configuration.isCloudFoundry()) {
      return Configuration.getAppEnv().app['application_id'];
    }
  }

  public static getCFApplicationIDAndInstanceIndex(): string {
    if (Configuration.isCloudFoundry()) {
      return Configuration.getCFApplicationID() + ':' + Configuration.getCFInstanceIndex();
    }
  }

  // Central System REST config
  public static getCentralSystemRestServiceConfig(): CentralSystemRestServiceConfiguration {
    // Read conf
    const centralSystemRestService = Configuration.getConfig().CentralSystemRestService;
    // Check Cloud Foundry
    if (!Configuration.isUndefined(centralSystemRestService)) {
      if (Configuration.isCloudFoundry()) {
        // CF Environment: Override
        centralSystemRestService.port = Configuration.getAppEnv().port;
        centralSystemRestService.host = Configuration.getAppEnv().bind;
        centralSystemRestService.userTokenKey = Configuration.getUserProvidedCredential(CloudCredentialsKey.USER_TOKEN_KEY);
        centralSystemRestService.captchaSecretKey = Configuration.getUserProvidedCredential(CloudCredentialsKey.CAPTCHA_SECRET_KEY);
      }
      if (Configuration.isUndefined(centralSystemRestService.socketIO)) {
        centralSystemRestService.socketIO = true;
      }
      if (Configuration.isUndefined(centralSystemRestService.socketIOSingleNotificationIntervalSecs)) {
        centralSystemRestService.socketIOSingleNotificationIntervalSecs = 1;
      }
      if (Configuration.isUndefined(centralSystemRestService.socketIOListNotificationIntervalSecs)) {
        centralSystemRestService.socketIOListNotificationIntervalSecs = 5;
      }
    }
    return centralSystemRestService;
  }

  // OCPI Server Configuration
  public static getOCPIServiceConfig(): OCPIServiceConfiguration {
    // Read conf
    const ocpiService = Configuration.getConfig().OCPIService;
    // Check Cloud Foundry
    if (!Configuration.isUndefined(ocpiService) && Configuration.isCloudFoundry()) {
      // CF Environment: Override
      ocpiService.port = Configuration.getAppEnv().port;
      ocpiService.host = Configuration.getAppEnv().bind;
    }
    return ocpiService;
  }

  // OData Server Configuration
  public static getODataServiceConfig(): ODataServiceConfiguration {
    // Read conf
    const oDataservice = Configuration.getConfig().ODataService;
    // Check Cloud Foundry
    if (!Configuration.isUndefined(oDataservice) && Configuration.isCloudFoundry()) {
      // CF Environment: Override
      oDataservice.port = Configuration.getAppEnv().port;
      oDataservice.host = Configuration.getAppEnv().bind;
    }
    return oDataservice;
  }

  // Rest Service Configuration - Internet view
  public static getCentralSystemRestServer(): CentralSystemServerConfiguration {
    return Configuration.getConfig().CentralSystemServer;
  }

  // Central System REST config
  public static getWSDLEndpointConfig(): WSDLEndpointConfiguration {
    return Configuration.getConfig().WSDLEndpoint;
  }

  // Central System Json config
  public static getJsonEndpointConfig(): JsonEndpointConfiguration {
    return Configuration.getConfig().JsonEndpoint;
  }

  // Central System OCPI config
  public static getOCPIEndpointConfig(): OCPIEndpointConfiguration {
    return Configuration.getConfig().OCPIEndpoint;
  }

  // Central System Front-End config
  public static getCentralSystemFrontEndConfig(): CentralSystemFrontEndConfiguration {
    // Read conf
    return Configuration.getConfig().CentralSystemFrontEnd;
  }

  // Email config
  public static getEmailConfig(): EmailConfiguration {
    // Read conf
    const emailConfig = Configuration.getConfig().Email;
    if (!Configuration.isUndefined(emailConfig) && Configuration.isCloudFoundry()) {
      if (!Configuration.isUndefined(emailConfig.smtp)) {
        emailConfig.smtp.user = Configuration.getUserProvidedCredential(CloudCredentialsKey.SMTP_USERNAME);
        emailConfig.smtp.password = Configuration.getUserProvidedCredential(CloudCredentialsKey.SMTP_PASSWORD);
      }
      if (!Configuration.isUndefined(emailConfig.smtpBackup)) {
        emailConfig.smtpBackup.user = Configuration.getUserProvidedCredential(CloudCredentialsKey.SMTP_BACKUP_USERNAME);
        emailConfig.smtpBackup.password = Configuration.getUserProvidedCredential(CloudCredentialsKey.SMTP_BACKUP_PASSWORD);
      }
    }
    return emailConfig;
  }

  // Email config
  public static getEVDatabaseConfig(): EVDatabaseConfiguration {
    // Read conf
    const evDatabaseConfig = Configuration.getConfig().EVDatabase;
    if (Configuration.isCloudFoundry()) {
      evDatabaseConfig.key = Configuration.getUserProvidedCredential(CloudCredentialsKey.EV_DATABASE_KEY);
    }
    return evDatabaseConfig;
  }

  // DB config
  public static getStorageConfig(): StorageConfiguration {
    // Read conf
    let storageConfig: StorageConfiguration = Configuration.getConfig().Storage;
    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      if (Configuration.isUndefined(storageConfig)) {
        storageConfig = {} as StorageConfiguration;
      }
      if (Configuration.isUndefined(storageConfig.implementation)) {
        storageConfig.implementation = 'mongodb';
      }
      if (Configuration.isUndefined(storageConfig.poolSize)) {
        storageConfig.poolSize = 200;
      }
      // CF Environment: Override
      // Check if MongoDB is provisioned inside SCP
      if (Configuration.getAppEnv().getService(new RegExp(/^e-Mobility-db*/))) {
        const mongoDBServiceCredentials = Configuration.getAppEnv().getServiceCreds(new RegExp(/^e-Mobility-db*/));
        // Set MongoDB URI
        if (mongoDBServiceCredentials) {
          storageConfig.uri = mongoDBServiceCredentials['uri'];
          storageConfig.port = mongoDBServiceCredentials['port'];
          storageConfig.user = mongoDBServiceCredentials['username;'];
          storageConfig.password = mongoDBServiceCredentials['password'];
          storageConfig.replicaSet = mongoDBServiceCredentials['replicaset'];
        }
      // Provisioned with User Provided Service
      } else if (Configuration.getAppEnv().getService(new RegExp(/^mongodbatlas*/))) {
        // Find the service
        const mongoDBServiceCredentials = Configuration.getAppEnv().getServiceCreds(new RegExp(/^mongodbatlas*/));
        // Set MongoDB URI
        if (!Configuration.isUndefined(mongoDBServiceCredentials['uri'])) {
          storageConfig.uri = mongoDBServiceCredentials['uri'];
        } else {
          console.error('Connection URI not found in MongoDB Atlas User Defined Service');
        }
      }
    }
    return storageConfig;
  }

  // Central System config
  public static getChargingStationConfig(): ChargingStationConfiguration {
    // Read conf and set defaults values
    const chargingStationConfiguration: ChargingStationConfiguration = Configuration.getConfig().ChargingStation;
    Configuration.deprecateConfigurationKey('heartbeatIntervalSecs', 'ChargingStation', 'Please use \'heartbeatIntervalOCPPSSecs\' and \'heartbeatIntervalOCPPJSecs\' instead');
    if (Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalOCPPSSecs)) {
      if (!Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalSecs)) {
        chargingStationConfiguration.heartbeatIntervalOCPPSSecs = chargingStationConfiguration.heartbeatIntervalSecs;
      } else {
        chargingStationConfiguration.heartbeatIntervalOCPPSSecs = 180;
      }
    }
    if (Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalOCPPJSecs)) {
      if (!Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalSecs)) {
        chargingStationConfiguration.heartbeatIntervalOCPPJSecs = chargingStationConfiguration.heartbeatIntervalSecs;
      } else {
        chargingStationConfiguration.heartbeatIntervalOCPPJSecs = 3600;
      }
    }
    if (Configuration.isUndefined(chargingStationConfiguration.maxLastSeenIntervalSecs)) {
      if (!Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalSecs)) {
        chargingStationConfiguration.maxLastSeenIntervalSecs = 3 * chargingStationConfiguration.heartbeatIntervalSecs;
      } else {
        chargingStationConfiguration.maxLastSeenIntervalSecs = 540;
      }
    }
    delete chargingStationConfiguration.heartbeatIntervalSecs;
    Configuration.deprecateConfigurationKey('useServerLocalIPForRemoteCommand', 'ChargingStation');
    Configuration.deprecateConfigurationKey('secureLocalServer', 'ChargingStation');
    return chargingStationConfiguration;
  }

  // Logging
  public static getLoggingConfig(): LoggingConfiguration {
    // Read conf
    return Configuration.getConfig().Logging;
  }

  // WSClient
  public static getWSClientConfig(): WSClientConfiguration {
    // Read conf and set defaults values
    if (Configuration.isUndefined(Configuration.getConfig().WSClient)) {
      Configuration.getConfig().WSClient = {} as WSClientConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().WSClient.autoReconnectMaxRetries)) {
      Configuration.getConfig().WSClient.autoReconnectMaxRetries = Constants.WS_DEFAULT_RECONNECT_MAX_RETRIES;
    }
    if (Configuration.isUndefined(Configuration.getConfig().WSClient.autoReconnectTimeout)) {
      Configuration.getConfig().WSClient.autoReconnectTimeout = Constants.WS_DEFAULT_RECONNECT_TIMEOUT;
    }
    return Configuration.getConfig().WSClient;
  }

  public static getHealthCheckConfig(): HealthCheckConfiguration {
    // Read conf and set defaults values
    if (Configuration.isUndefined(Configuration.getConfig().HealthCheck)) {
      Configuration.getConfig().HealthCheck = {} as HealthCheckConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().HealthCheck.enabled)) {
      Configuration.getConfig().HealthCheck.enabled = true;
    }
    return Configuration.getConfig().HealthCheck;
  }

  public static getMigrationConfig(): MigrationConfiguration {
    // Read conf and set defaults values
    if (Configuration.isUndefined(Configuration.getConfig().Migration)) {
      Configuration.getConfig().Migration = {} as MigrationConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().Migration.active)) {
      Configuration.getConfig().Migration.active = false;
    }
    return Configuration.getConfig().Migration;
  }

  static getChargingStationTemplatesConfig(): ChargingStationTemplatesConfiguration {
    // Read conf and set defaults values
    if (Configuration.isUndefined(Configuration.getConfig().ChargingStationTemplates)) {
      Configuration.getConfig().ChargingStationTemplates = {} as ChargingStationTemplatesConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().ChargingStationTemplates.templatesFilePath)) {
      Configuration.getConfig().ChargingStationTemplates.templatesFilePath = `${global.appRoot}/assets/charging-station-templates/charging-stations.json`;
    }
    return Configuration.getConfig().ChargingStationTemplates;
  }

  static getAxiosConfig(): AxiosConfiguration {
    // Read conf and set defaults values
    if (Configuration.isUndefined(Configuration.getConfig().Axios)) {
      Configuration.getConfig().Axios = {} as AxiosConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().Axios.timeout)) {
      Configuration.getConfig().Axios.timeout = Constants.AXIOS_DEFAULT_TIMEOUT;
    }
    if (Configuration.isUndefined(Configuration.getConfig().Axios.retries)) {
      Configuration.getConfig().Axios.retries = 3;
    }
    return Configuration.getConfig().Axios;
  }

  private static deprecateConfigurationKey(key: string, configSectionName: string, logMsgToAppend = '') {
    if (!Configuration.isUndefined(Configuration.getConfig()[configSectionName][key])) {
      console.warn(`Deprecated configuration key '${key}' usage in section '${configSectionName}'${logMsgToAppend && '. ' + logMsgToAppend}`);
    }
  }

  private static getUserProvidedCredential(key: CloudCredentialsKey): string {
    // Get the credentials
    const credentials: CloudCredentials = Configuration.getAppEnv().getServiceCreds('emobility-credentials') as CloudCredentials;
    if (!Configuration.isNullOrUndefined(credentials) && !Configuration.isUndefined(credentials[key])) {
      return credentials[key];
    }
    console.error(`Credentials or credential key ${key} not found or bound in CF 'emobility-credentials' User Provided Credentials Service`);
  }

  // Read the config file
  private static getConfig(): ConfigurationData {
    if (!Configuration.config) {
      Configuration.config = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/config.json`, 'utf8')) as ConfigurationData;
    }
    return Configuration.config;
  }

  private static getAppEnv(): AppEnv {
    if (!Configuration.appEnv) {
      Configuration.appEnv = getAppEnv();
    }
    return Configuration.appEnv;
  }

  // Declare class private helpers for undefined or null detection to avoid circular dependency with mocha and Utils helpers
  private static isUndefined(obj: any): boolean {
    return typeof obj === 'undefined';
  }

  private static isNullOrUndefined(obj: any): boolean {
    // eslint-disable-next-line no-eq-null, eqeqeq
    return obj == null;
  }
}

