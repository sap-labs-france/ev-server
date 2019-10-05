import ClusterConfiguration from './ClusterConfiguration';
import ODataServiceConfiguration from './ODataServiceConfiguration';
import StorageConfiguration from './StorageConfiguration';
import WSClientConfiguration from './WSClientConfiguration';

export default interface Config {
  Crypto: {
    key: string;
    algorithm: string;
  };
  Cluster: ClusterConfiguration;
  CentralSystemServer: {
    protocol: string;
    host: string;
    port: string;
  };
  CentralSystems: {
    type: string;
    implementation: string;
    protocol: string;
    host: string;
    port: number;
    debug: boolean;
  }[];
  CentralSystemRestService: {
    protocol: string;
    host: string;
    port: number;
    userTokenKey: string;
    userTokenLifetimeHours: number;
    userDemoTokenLifetimeDays: number;
    webSocketNotificationIntervalSecs: number;
    passwordWrongNumberOfTrial: number;
    passwordBlockedWaitTimeMin: number;
    captchaSecretKey: string;
    socketIO: boolean;
    debug: boolean;
  };
  CentralSystemFrontEnd: {
    protocol: string;
    host: string;
    port: number;
    distEnabled?: boolean;
    distPath?: string;
  };
  WSDLEndpoint: {
    baseUrl: string;
  };
  JsonEndpoint: {
    baseUrl: string;
  };
  WSClient: WSClientConfiguration;
  OCPIService: {
    protocol: string;
    externalProtocol: string;
    host: string;
    port: number;
    debug: boolean;
    tenantEnabled: string[];
    eMI3id: any;
  };
  ODataService: ODataServiceConfiguration;
  Email: {
    from: string;
    admins: string[];
    bcc: string;
    smtp: {
      from: string;
      host: string;
      port: number;
      secure: boolean;
      requireTLS: boolean;
      user: string;
      password: string;
    };
    smtpBackup: {
      from: string;
      host: string;
      port: number;
      secure: boolean;
      requireTLS: boolean;
      user: string;
      password: string;
    };
  };
  Storage: StorageConfiguration;
  Notification: {
    Email: {
      enabled: boolean;
    };
  };
  Authorization: {
    debug: boolean;
  };
  ChargingStation: {
    heartbeatIntervalSecs: number;
    checkEndOfChargeNotificationAfterMin: number;
    notifBeforeEndOfChargeEnabled: boolean;
    notifBeforeEndOfChargePercent: number;
    notifEndOfChargeEnabled: boolean;
    notifEndOfChargePercent: number;
    notifStopTransactionAndUnlockConnector: boolean;
  };
  Locales: {
    default: string;
    supported: string[];
  };
  Advanced: {
    chargeCurveTimeFrameSecsPoint: number;
  };
  Scheduler: {
    active: boolean;
    tasks: {
      name: string;
      active: boolean;
      periodicity: string;
      config: {
        retentionPeriodWeeks: number;
        securityRetentionPeriodWeeks: number;
      };
    }[];
  };
  Logging: {
    logLevel: string;
    consoleLogLevel: string;
    trace: boolean;
    traceLogOnlyStatistics: boolean;
    traceStatisticInterval: number;
    moduleDetails: {
      ChargingStation: {
        logLevel: string;
        consoleLogLevel: string;
      };
      Authorizations: {
        logLevel: string;
        consoleLogLevel: string;
      };
    };
  };
  Test: any;
}
