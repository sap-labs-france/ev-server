import CentralSystemServerConfiguration from './CentralSystemServerConfiguration';

export default interface CentralSystemRestServiceConfiguration extends CentralSystemServerConfiguration {
  userTokenKey: string;
  userTokenLifetimeHours: number;
  userDemoTokenLifetimeDays: number;
  socketIO?: boolean;
  socketIOListNotificationIntervalSecs?: number;
  socketIOSingleNotificationIntervalSecs?: number;
  passwordWrongNumberOfTrial: number;
  passwordBlockedWaitTimeMin: number;
  captchaSecretKey: string;
  debug: boolean;
}
