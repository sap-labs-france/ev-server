export interface TaskConfig {
}

export type CheckOfflineChargingStationsTaskConfig = TaskConfig;

export interface CheckPreparingSessionNotStartedTaskConfig extends TaskConfig {
  preparingStatusMaxMins?: number;
}

export interface LoggingDatabaseTableCleanupTaskConfig extends TaskConfig {
  retentionPeriodWeeks?: number;
  securityRetentionPeriodWeeks?: number;
}

export interface LoggingDatabaseTableCleanupTaskConfig extends TaskConfig {
  retentionPeriodWeeks?: number;
  securityRetentionPeriodWeeks?: number;
}

export interface CheckUserAccountInactivityTaskConfig extends TaskConfig {
  userAccountInactivityMonths?: number;
}
export interface CheckSessionNotStartedAfterAuthorizeTaskConfig extends TaskConfig {
  sessionShouldBeStartedAfterMins?: number;
  checkPastAuthorizeMins?: number;
}

export interface OCPIGetTokensTaskConfig extends TaskConfig {
  partial?: boolean;
}

export interface OCPIGetLocationsTaskConfig extends TaskConfig {
  partial?: boolean;
}

export interface OCPIPushLocationsTaskConfig extends TaskConfig {
  processAllEVSEs?: boolean;
}
