export default interface ChargingStationConfiguration {
  heartbeatIntervalOCPPSSecs: number;
  heartbeatIntervalOCPPJSecs: number;
  pingIntervalOCPPJSecs: number;
  monitoringIntervalOCPPJSecs: number;
  checkEndOfChargeNotificationAfterMin: number;
  notifBeforeEndOfChargeEnabled: boolean;
  notifBeforeEndOfChargePercent: number;
  notifEndOfChargeEnabled: boolean;
  notifEndOfChargePercent: number;
  notifStopTransactionAndUnlockConnector: boolean;
  useServerLocalIPForRemoteCommand?: boolean;
  secureLocalServer?: boolean;
  maxLastSeenIntervalSecs: number;
}
