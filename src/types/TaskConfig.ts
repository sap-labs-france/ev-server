export interface TaskConfig {
  retentionPeriodWeeks?: number;
  securityRetentionPeriodWeeks?: number;
  userAccountInactivityMonths?: number;
  offlineChargingStationMins?: number;
  preparingStatusMaxMins?: number;
}
