export default interface ChargingStationConfiguration {
  heartbeatIntervalSecs: number;
  checkEndOfChargeNotificationAfterMin: number;
  notifBeforeEndOfChargeEnabled: boolean;
  notifBeforeEndOfChargePercent: number;
  notifEndOfChargeEnabled: boolean;
  notifEndOfChargePercent: number;
  notifStopTransactionAndUnlockConnector: boolean;
}