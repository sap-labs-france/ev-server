// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TaskConfig {}

export type CheckOfflineChargingStationsTaskConfig = TaskConfig;

export interface CheckPreparingSessionNotStartedTaskConfig extends TaskConfig {
  preparingStatusMaxMins?: number;
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

export interface BillingPeriodicOperationTaskConfig extends TaskConfig {
  onlyProcessUnpaidInvoices?: boolean;
  forceOperation?: boolean;
}

export interface DispatchFundsTaskConfig extends TaskConfig {
  forceOperation?: boolean;
}

export interface OCPIPullTokensTaskConfig extends TaskConfig {
  partial?: boolean;
}

export interface OCPIPullLocationsTaskConfig extends TaskConfig {
  partial?: boolean;
}

export interface OCPIPushTokensTaskConfig extends TaskConfig {
  partial?: boolean;
}

export interface OCPIPushEVSEStatusesTaskConfig extends TaskConfig {
  partial?: boolean;
}

export interface OICPPushEvseDataTaskConfig extends TaskConfig {
  partial?: boolean;
}

export interface OICPPushEvseStatusTaskConfig extends TaskConfig {
  partial?: boolean;
}
