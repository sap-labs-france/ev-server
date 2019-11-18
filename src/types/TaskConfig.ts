export interface TaskConfig {
}

export interface CheckOfflineChargingStationTaskConfig extends TaskConfig {
  offlineChargingStationMins?: number;
}

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
