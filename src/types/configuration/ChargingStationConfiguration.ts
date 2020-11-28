export default interface ChargingStationConfiguration {
  heartbeatIntervalSecs?: number;
  heartbeatIntervalOCPPSSecs: number;
  heartbeatIntervalOCPPJSecs: number;
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
