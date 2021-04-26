import { ServerProtocol } from '../Server';

export default interface CentralSystemRestServiceConfiguration {
  protocol: ServerProtocol;
  host: string;
  port: number;
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
