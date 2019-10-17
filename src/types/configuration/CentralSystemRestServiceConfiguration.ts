export default interface CentralSystemRestServiceConfiguration {
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
}