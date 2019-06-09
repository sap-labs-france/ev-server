export interface ODataServiceCfg {
  protocol: string;
  host: string;
  port: number;
  externalProtocol: string;
  debug: boolean;
}

export interface Config {
  ODataService: ODataServiceCfg;
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
    captchaSecretKey: number;
    socketIO: boolean;
    debug: boolean;
  };
  CentralSystemFrontEnd: {
    protocol: string;
    host: string;
    port: number;
  };
  WSDLEndpoint: {
    baseUrl: string;
  };
  JsonEndpoint: {
    baseUrl: string;
  };
  Storage: {
    implementation: string;
    uri: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    poolSize: number;
    replicaSet: string;
    monitorDBChange: boolean;
    debug: boolean;
  };
  OCPIService: {
    protocol: string;
    host: string;
    port: number;
    debug: boolean;
    tenantEnabled: string[];
    eMI3id: any;
  };/*
  "Notification": {
		"Email": {
			"enabled": true
		}
	},
	"Authorization": {
		"debug": false
	},
	"ChargingStation" : {
		"heartbeatIntervalSecs": 60,
		"notifBeforeEndOfChargeEnabled": true,
		"notifBeforeEndOfChargePercent": 85,
		"notifEndOfChargeEnabled": true,
		"notifStopTransactionAndUnlockConnector": false
	},
	"Locales" : {
		"default": "en_US",
		"supported": ["en_US", "fr_FR"]
	},
	"Advanced" : {
		"chargeCurveTimeFrameSecsPoint": 60
	},
	"Scheduler" : {
		"active" : true,
		"tasks": [
			{
				"name": "loggingDatabaseTableCleanup",
				"active": true,
				"periodicity": "0 0 * * 1",
				"config": {
					"retentionPeriodWeeks": 4,
					"securityRetentionPeriodWeeks": 4
				}
			}
		]
  },
  "Logging": {
    "logLevel": "D",
    "consoleLogLevel": "NONE",
    "trace": false,
    "moduleDetails": {
      "ChargingStation": {
        "logLevel": "DEFAULT",
        "consoleLogLevel": "DEFAULT"
      },
      "Authorizations": {
        "logLevel": "DEFAULT",
        "consoleLogLevel": "DEFAULT"
      }
    }
  }*/
}
